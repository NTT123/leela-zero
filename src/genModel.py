import sys
import struct
import time
import json
import numpy
from os import system

for _ in range(10000000000000000):
    try:
        system("git checkout -f")
        system("git clean -xdf")
        system("wget http://zero.sjeng.org/best-network-hash")

        nw = open("best-network-hash").readlines()
        myhash = nw[0][0:-1]

        if len(myhash) < 10:
            sys.exit(-1);

        print("Downloading " + myhash)
        system("axel -a -n 16 -o %s.gz http://zero.sjeng.org/networks/%s.gz" % (myhash, myhash) )

        system("gunzip "+ myhash + ".gz");

        print("Generating Kera model")



        f = open(myhash, "r")

        linecount = 0

        def testShape(s, si):
            t = 1
            for l in s:
                t = t * l
            if t != si:
                print("ERRROR: ", s, t, si)

        FORMAT_VERSION = "1\n"

        print("Detecting the number of residual layers...")

        w = f.readlines()
        linecount = len(w)

        if w[0] != FORMAT_VERSION:
            print("Wrong version")
            sys.exit(-1)

        count = len(w[2].split(" "))
        print("%d channels..." % count)

        residual_blocks = linecount - (1 + 4 + 14)

        if residual_blocks % 8 != 0:
            print("Inconsistent number of layers.")
            sys.exit(-1)

        residual_blocks = residual_blocks // 8
        print("%d blocks" % residual_blocks)


        plain_conv_layers = 1 + (residual_blocks * 2)
        plain_conv_wts = plain_conv_layers * 4

        output = myhash
        fout = open(output + ".buf", "wb")
        foutw = open(output + ".meta.json", "w")
        foutp = open(output + ".proto.json", "w")

        model_proto = {}
        model_meta = []
        model_proto['class_name'] = "Model"
        model_proto['keras_version'] = "1.1.1"
        model_proto['config'] = {}

        layers = []
        model_proto['config']["layers"] = layers

        nw = w[1:]

        w = None

        ss = 0


        def genLayer(cl, name="", previous="", activation="", previous1="", grid=3, filter=-1):
            l = {}
            l["name"] = name
            l["class_name"] = cl
            l["config"] = {}
            config = l["config"]
            config["name"] = name
            l["inbound_nodes"] = [[[previous, 0, 0]]]
            if cl == "InputLayer":
                l["inbound_nodes"] = []
                l["name"] = "main_input"
                config["name"] = "main_input"
                config["sparse"] = False
                config["input_dtype"] = "float32"
                config["batch_input_shape"] = [None, 19, 19, 18],

            if cl == "tanh":
                l["class_name"] = "Activation"
                config["name"] = name
                config["activation"] = "tanh"
                config["trainable"] = False

            if cl == "softmax":
                l["class_name"] = "Activation"
                config["name"] = name
                config["activation"] = "softmax"
                config["trainable"] = False

            if cl == "relu":
                l["class_name"] = "Activation"
                config["name"] = name
                config["activation"] = "relu"
                config["trainable"] = False

            if cl == "swap":
                l["class_name"] = "Swap"
                config["name"] = name

            if cl == "flatten":
                l["class_name"] = "Flatten"
                config["name"] = name

            if cl == "FC":
                l["class_name"] = "Dense"
                config["name"] = name

            if cl == "Convolution2D":
                config["W_constraint"] = None
                config["b_constraint"] = None
                config["b_regularizer"] = None
                config["W_regularizer"] = None
                config["activity_regularizer"] = None
                config["border_mode"] = "same"
                config["dim_ordering"] = "tf"
                config["activation"] = "linear"
                config["nb_col"] = grid
                config["nb_row"] = grid
                config["init"] = "glorot_uniform"
                config["nb_filter"] = filter
                config["bias"] = True
                config["trainable"] = True
                config["subsample"] = [1, 1]

            if cl == "BatchNormalization":
                config["gamma_regularizer"] = None
                config["beta_regularizer"] = None
                config["epsilon"] = 0.00001
                config["trainable"] = True
                config["mode"] = 0
                config["axis"] = 3
                config["momentum"] = 0.0

            if cl == "Merge":
                config["concat_axis"] = -1
                config["mode_type"] = "raw"
                config["dot_axes"] = -1
                config["mode"] = "sum"
                config["output_shape"] = None
                config["output_shape_type"] = "raw"
                l["inbound_nodes"] = [[[previous, 0, 0], [previous1, 0, 0]]]

            return l


        weight_meta = []
        previous = None

        l = genLayer("InputLayer")
        previous = "main_input"
        layers.append(l)

        for i in range(plain_conv_wts // 4):
            ii = i

            l1 = genLayer(cl="Convolution2D", name="conv2d%d" %
                          ii, grid=3, filter=count, previous=previous)
            previous = "conv2d%d" % ii
            l2 = genLayer(cl="BatchNormalization", name="bn%d" % ii, previous=previous)
            previous = "bn%d" % ii
            layers.append(l1)
            layers.append(l2)

            if i == 0:
                l3 = genLayer(cl="relu", name="relu%d" % ii, previous=previous)
                previous = "relu%d" % ii
                layers.append(l3)

            if i > 0:
                if i % 2 == 1:
                    l3 = genLayer(cl="relu", name="relu%d" % ii, previous=previous)
                    previous = "relu%d" % ii
                    layers.append(l3)
                else:
                    l3 = genLayer(cl="Merge", name="residual%d" %
                                  ii, previous=previous,  previous1="relu%d" % (ii - 2))
                    previous = "residual%d" % ii
                    l4 = genLayer(cl="relu", name="relu%d" % ii, previous=previous)
                    previous = "relu%d" % ii
                    layers.append(l3)
                    layers.append(l4)

            for j in range(4):
                l = nw[i * 4 + j]
                vec = [float(v) for v in l.split(" ")]

                if j == 0:
                    name = "conv2d_W:0"
                    if i == 0:
                        shape = [3, 3, 18, count]
                    else:
                        shape = [3, 3, count, count]
                if j == 1:
                    name = "conv2d_b:0"
                    shape = [count]
                if j == 2:
                    name = "bn_running_mean:0"
                    shape = [count]
                if j == 3:
                    name = "bn_running_var:0"
                    shape = [count]

                if j == 0:
                    # conv
                    nv = numpy.asarray(vec)
                    ns = count
                    if i == 0:
                        ns = 18
                    nv = nv.reshape((count, ns, 3, 3))
                    nv = nv.transpose((2, 3, 1, 0))
                    print(nv.shape)
                    nv = nv.reshape(len(vec))
                    vec = nv.tolist()

                buf = struct.pack('%sf' % len(vec), *vec)
                fout.write(buf)

                wlayer = {}

                wlayer["weight_name"] = "%s%d_%s" % (
                    name.split('_')[0], i, "_".join(name.split('_')[1:]))
                wlayer["layer_name"] = "%s%d" % (name.split('_')[0], i)
                wlayer["length"] = len(vec)
                wlayer["shape"] = shape
                testShape(shape, len(vec))
                wlayer["offset"] = ss
                wlayer["type"] = "float32"
                weight_meta.append(wlayer)
                ss = ss + len(buf)

        s_p = previous

        name = "pol!conv2d"
        l1 = genLayer(cl="Convolution2D", name=name, previous=s_p, grid=1, filter=2)
        previous = name

        name = "pol!bn"
        l2 = genLayer(cl="BatchNormalization", name=name, previous=previous)
        previous = name

        name = "pol!relu"
        l2_relu = genLayer(cl="relu", name=name, previous=previous)
        previous = name

        name = "pol!flatten"
        l3 = genLayer(cl="flatten", name=name, previous=previous)
        previous = name

        # name = "pol!swap"
        # l3_swap = genLayer(cl="swap", name=name, previous=previous)
        # previous = name

        name = "pol!fc"
        l4 = genLayer(cl="FC", name=name, previous=previous)
        previous = name

        #name = "pol!softmax"
        #l5 = genLayer(cl="softmax", name=name, previous=previous)
        #previous = name

        layers.append(l1)
        layers.append(l2)
        layers.append(l2_relu)
        layers.append(l3)
        #layers.append(l3_swap)
        layers.append(l4)
        #layers.append(l5)


        for i in range(6):
            l = nw[plain_conv_wts + i]
            vec = [float(v) for v in l.split(" ")]

            if i == 0:
                name = "pol!conv2d_W:0"
                shape = [1, 1, count, 2]
            if i == 1:
                name = "pol!conv2d_b:0"
                shape = [2]
            if i == 2:
                name = "pol!bn_running_mean:0"
                shape = [2]
            if i == 3:
                name = "pol!bn_running_var:0"
                shape = [2]
            if i == 4:
                name = "pol!fc_W:0"
                shape = [2 * 19 * 19, 19 * 19 + 1]
            if i == 5:
                name = "pol!fc_b:0"
                shape = [19 * 19 + 1]

            if i == 0:
                nv = numpy.asarray(vec)

                nv = nv.reshape((2, count, 1, 1))

                nv = nv.transpose((2, 3, 1, 0))
                print(nv.shape)
                nv = nv.reshape(len(vec))
                vec = nv.tolist()

            if i == 4:
                nv = numpy.asarray(vec)
                nv = nv.reshape((shape[1], shape[0]))

                nv = nv.transpose()
                print("Special", nv.shape)
                for kk in range( 362 ):
                    cc = nv[:, kk]
                    bb = cc.reshape( (2, 19, 19) )
                    aa = bb.transpose(  (1,2,0) )
                    dd = aa.reshape(722)
                    nv[:, kk] = dd

                nv = nv.reshape(len(vec))
                vec = nv.tolist()

            buf = struct.pack('%sf' % len(vec), *vec)
            fout.write(buf)

            wlayer = {}

            wlayer["weight_name"] = name
            wlayer["layer_name"] = name.split('_')[0]
            wlayer["length"] = len(vec)
            wlayer["shape"] = shape
            testShape(shape, len(vec))
            wlayer["offset"] = ss
            wlayer["type"] = "float32"
            weight_meta.append(wlayer)
            ss = ss + len(buf)


        name = "val!conv2d"
        l1 = genLayer(cl="Convolution2D", name=name, previous=s_p, grid=1, filter=1)
        previous = name

        name = "val!bn"
        l2 = genLayer(cl="BatchNormalization", name=name, previous=previous)
        previous = name

        name = "val_BUG_!relu"
        lBUG = genLayer(cl="relu", name=name, previous=previous)
        previous = name

        name = "val!flatten"
        l3 = genLayer(cl="flatten", name=name, previous=previous)
        previous = name

        name = "val!fc1"
        l4 = genLayer(cl="FC", name=name, previous=previous)
        previous = name

        name = "val!relu"
        l5 = genLayer(cl="relu", name=name, previous=previous)
        previous = name

        name = "val!fc2"
        l6 = genLayer(cl="FC", name=name, previous=previous)
        previous = name

        name = "val!tanh"
        l7 = genLayer(cl="tanh", name=name, previous=previous)
        previous = name

        layers.append(l1)
        layers.append(l2)
        layers.append(lBUG)
        layers.append(l3)
        layers.append(l4)
        layers.append(l5)
        layers.append(l6)
        layers.append(l7)

        for i in range(8):
            l = nw[plain_conv_wts + 6 + i]
            vec = [float(v) for v in l.split(" ")]

            if i == 0:
                name = "val!conv2d_W:0"
                shape = [1, 1, count, 1]
            if i == 1:
                name = "val!conv2d_b:0"
                shape = [1]
            if i == 2:
                name = "val!bn_running_mean:0"
                shape = [1]
            if i == 3:
                name = "val!bn_running_var:0"
                shape = [1]
            if i == 4:
                name = "val!fc1_W:0"
                shape = [19 * 19, 256]
            if i == 5:
                name = "val!fc1_b:0"
                shape = [256]
            if i == 6:
                name = "val!fc2_W:0"
                shape = [256, 1]
            if i == 7:
                name = "val!fc2_b:0"
                shape = [1]

            if i == 0:
                nv = numpy.asarray(vec)

                nv = nv.reshape((1, count, 1, 1))

                nv = nv.transpose((2, 3, 1, 0))
                print(nv.shape)
                nv = nv.reshape(len(vec))
                vec = nv.tolist()

            if i == 4 or i == 6:
                nv = numpy.asarray(vec)
                nv = nv.reshape((shape[1], shape[0]))

                nv = nv.transpose()
                print(nv.shape)
                nv = nv.reshape(len(vec))
                vec = nv.tolist()

            buf = struct.pack('%sf' % len(vec), *vec)
            fout.write(buf)

            wlayer = {}

            wlayer["weight_name"] = name
            wlayer["layer_name"] = name.split('_')[0]
            wlayer["length"] = len(vec)
            wlayer["shape"] = shape
            testShape(shape, len(vec))
            wlayer["offset"] = ss
            wlayer["type"] = "float32"
            weight_meta.append(wlayer)
            ss = ss + len(buf)

        foutw.write(json.dumps(weight_meta))


        model_proto["config"]["input_layers"] = [["main_input", 0, 0]]
        model_proto["config"]["output_layers"] = [["val!tanh", 0, 0], ["pol!fc"]]
        foutp.write(json.dumps(model_proto))

        foutw.close()
        foutp.close()
        fout.close()
        f.close()


        system('mv '+ "best-network-hash ../docs")
        system('mv '+ myhash + ".buf ../docs")
        system('mv '+ myhash + ".meta.json ../docs")
        system('mv '+ myhash + ".proto.json ../docs")
        system("git add ../docs/best-network-hash ../docs/" + myhash + ".*")
        system("git commit -m "+ myhash)
        system("git push origin master")
    except Exception as e:
        print(e)

    time.sleep(10*60)
