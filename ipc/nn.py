import gc
import gzip
import numpy as np
import os
import shutil
import sys
import threading
import time
from six.moves import urllib

import theano
from theano import tensor as T
from theano.tensor.nnet import conv2d
from theano.tensor.nnet import relu
from theano.tensor.nnet import softmax
from theano.tensor.nnet.bn import batch_normalization_test as bn

BEST_NETWORK_HASH_URL = "http://zero.sjeng.org/best-network-hash"
BEST_NETWORK_URL = "http://zero.sjeng.org/networks/best-network.gz"

def getLatestNNHash():
    txt = urllib.request.urlopen(BEST_NETWORK_HASH_URL).read().decode()
    raw_net  = txt.split("\n")[0]
    return raw_net


def downloadBestNetworkWeight(nethash):
    try:
        # Test if network already exists
        return open(nethash).read()
    except FileNotFoundError as ex:
        print("Downloading weights", nethash)
        gzip_name = nethash + ".gz"
        urllib.request.urlretrieve(BEST_NETWORK_URL, gzip_name)
        print("Done!")
        with gzip.open(gzip_name, 'rb') as f_in, open(nethash, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
        # Cleanup .gz file
        os.remove(gzip_name)
        return open(nethash).read()


def downloadAndParseWeights(newhash):
    txt = downloadBestNetworkWeight(newhash)
    return loadWeight(txt)


def loadWeight(text):
    linecount = 0
    FORMAT_VERSION = "1"

    # print("Detecting the number of residual layers...")

    w = text.split("\n")
    linecount = len(w)

    if w[0] != FORMAT_VERSION:
        print("Wrong version")
        sys.exit(-1)

    filters = len(w[2].split(" "))
    # print("%d channels..." % filters)

    residual_blocks = linecount - (1 + 4 + 14)

    if residual_blocks % 8 != 0:
        print("Inconsistent number of layers.")
        sys.exit(-1)

    residual_blocks = residual_blocks // 8
    # print("%d blocks..." % residual_blocks)

    plain_conv_layers = 1 + (residual_blocks * 2)
    plain_conv_wts = plain_conv_layers * 4

    weights = [ [float(t) for t in l.split(" ")] for l in w[1:] ]
    return (weights, residual_blocks, filters)


def LZN(batch_size, ws, nb, nf):
    # ws: weights
    # nb: number of blocks
    # nf: number of filters

    # weight counter
    global wc
    wc = -1

    def loadW():
        global wc
        wc = wc + 1
        return ws[wc]


    def mybn(inp, nf, params, name):
        #mean0 = theano.tensor.vector(name + "_mean")
        w = np.asarray(loadW(), dtype=np.float32).reshape( (nf) )
        mean0 = theano.shared(w)
        # params.append(In(mean0, value=w))

        #var0  = theano.tensor.vector(name + "_var")
        w = np.asarray(loadW(), dtype=np.float32).reshape( (nf) )
        var0 = theano.shared(w)
        #params.append(In(var0, value=w))

        bn0   = bn(inp, gamma=T.ones(nf), beta=T.zeros(nf), mean=mean0,
                var=var0, axes = 'spatial', epsilon=1.0000001e-5)

        return bn0

    def myconv(inp, inc, outc, kernel_size, params, name):
        #f0 = theano.tensor.tensor4(name + '_filter')
        w = np.asarray(loadW(), dtype=np.float32).reshape( (outc, inc, kernel_size, kernel_size) )
        #params.append(In(f0, value=w))
        f0 = theano.shared(w)

        conv0 = conv2d(inp, f0, input_shape=(batch_size, inc, 19, 19),
                       border_mode='half',
                       filter_flip=False,
                       filter_shape=(outc, inc, kernel_size, kernel_size))
        b = loadW()  # zero bias
        if sum(abs(i) for i in b) != 0:
            print("ERROR! Should be 0")

        return conv0

    def residualBlock(inp, nf, params, name):
        conv0 = myconv(inp, nf, nf, 3, params, name + "_conv0")
        bn0   = mybn(conv0, nf, params, name + "_bn0")
        relu0 = relu(bn0)

        conv1 = myconv(relu0, nf, nf, 3, params, name + "_conv1")
        bn1   = mybn(conv1, nf, params, name + "_bn1")

        sum0  = inp + bn1
        out   = relu(sum0)

        return out

    def myfc(inp, insize, outsize, params, name):
        # W0 = theano.tensor.matrix(name + '_W')
        w = np.asarray(loadW(), dtype=np.float32).reshape( (outsize, insize) ).T
        #params.append(In(W0, value=w))
        W0 = theano.shared(w)

        # b0 = theano.tensor.vector(name + '_b')
        b = np.asarray(loadW(), dtype=np.float32).reshape( (outsize) )
        # params.append(In(b0, value=b))
        b0 = theano.shared(b)

        out = T.dot(inp, W0) + b0
        return out


    params = []
    # theano.tensor.tensor4('input'))
    x = theano.shared(np.zeros( (batch_size, 18, 19, 19), dtype=np.float32 ) )
    # params.append(x)
    conv0 = myconv(x, 18, nf, 3, params, "conv0")
    bn0   = mybn(conv0, nf, params, "bn0")

    relu0 = relu(bn0)
    inp = relu0

    for i in range(nb):
        inp = residualBlock(inp, nf, params, "res%d" % (i+1))

    polconv0 = myconv(inp, nf, 2, 1, params, "polconv0")
    polbn0   = mybn(polconv0, 2, params, "polbn0")
    polrelu0 = relu(polbn0)
    polfcinp = polrelu0.flatten(ndim=2)
    polfcout = softmax(myfc(polfcinp, 19*19*2, 19*19+1, params, "polfc"))

    out = polfcout

    valconv0 = myconv(inp, nf, 1, 1, params, "valconv0")
    valbn0   = mybn(valconv0, 1, params, "valbn0")
    valrelu0 = relu(valbn0)

    valfc0inp = valrelu0.flatten(ndim=2)
    valfc0out = myfc(valfc0inp, 19*19, 256, params, "valfc0")
    valrelu0  = relu(valfc0out)

    valfc1out = myfc(valrelu0, 256, 1, params, "valfc1")
    valout  = valfc1out

    out = T.concatenate( [polfcout, T.tanh(valout)], axis=1 )
    return (x, theano.function(params, out))


class TheanoLZN():
    def __init__(self, batch_size):
        self.batch_size = batch_size
        self.lock = threading.Lock()
        self.net = None
        self.net_hash = ""
        self.next_weights = None

        self.setupNN()

    def setupNN(self):
        if self.next_weights:
            newhash, data = self.next_weights
            self.next_weights = None
        else:
            print("\nLoading latest network")
            newhash = getLatestNNHash()
            print("Hash: ", newhash)
            data = downloadAndParseWeights(newhash)

        self.lock.acquire()

        self.net = None
        gc.collect()  # hope that GPU memory is freed, not sure :-()

        print("\nCompling the latest neural network")
        weights, numBlocks, numFilters = data
        self.net = LZN(self.batch_size, weights, numBlocks, numFilters)
        self.net_hash = newhash
        print ("Done!")

        self.lock.release()


    def runNN(self, input_data):
        if self.next_weights:
            self.setupNN()

        self.lock.acquire()
        self.net[0].set_value(input_data.reshape(self.batch_size, 18, 19, 19))
        qqq = self.net[1]().astype(np.float32)
        self.lock.release()
        return qqq


    def startWeightUpdater(self):
        def backgroundWeightUpdater():
            print("\nThread watching for new weights\n")
            while True:
                try:
                    if self.next_weights == None:
                        testhash = getLatestNNHash()
                        if testhash != self.net_hash:
                            print("New net arrived:", testhash)
                            new_data = downloadAndParseWeights(testhash)
                            self.next_weights = (testhash, new_data)

                except Exception as ex:
                    print("WeightUpdaterError", ex)
                time.sleep(20)

        updaterThread = threading.Thread(target=backgroundWeightUpdater)
        updaterThread.daemon = True
        updaterThread.start()
