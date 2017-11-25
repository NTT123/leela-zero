'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function TensorProgram(shader, out, uniforms) {
    out.compile(shader, uniforms);
    return {
        output: out,
        run: function run(options, callback) {
            out.run(shader, uniforms, callback);
        },
        destroy: function destroy() {
            out.destroy();
            for (var param in uniforms) {
                if (uniforms[param] instanceof Tensor) {
                    uniforms[param].destroy();
                }
            }
        }
    };
}

function makeOutput(gl, layer, shape) {
    return new OutputTensor(gl, shape, getFormat(layer));
}

function makeTensor(gl, layer, data) {
    // return new Tensor(gl, data)

    return new Tensor(gl, data, {
        type: 'float32',
        pack: 'stride',
        density: '4:4',
        codec: 'raw',
        min: ndops.inf(data),
        max: ndops.sup(data)
    });
    // return {type: "uint8", pack: "stride", density: "4:4", codec: "linquant", min: stats.min, max: stats.max }
}

function InputLayer(gl, layer, deps, options) {
    if (!options[layer.name]) throw new Error("Invalid input");
    var tensor = new OutputTensor(gl, options[layer.name]);
    return {
        output: tensor,
        run: function run(options, callback) {
            if (options[layer.name]) {
                tensor.update(options[layer.name]);
            }
            if (callback) callback();
        },
        destroy: function destroy() {
            tensor.destroy();
        }
    };
}

function getFormat(layer) {
    return undefined;
}

function ComputeMean(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor image;\n        const ivec2 tileSize = #(image.shape).xy;\n\n        vec4 process4(ivec4 pos) {\n            vec4 sum = vec4(0, 0, 0, 0);\n            for(int x = 0; x < tileSize.x; x++){\n                for(int y = 0; y < tileSize.y; y++){\n                    sum += image.read4(ivec4(x, y, pos.z, 0));\n                }\n            }\n            return sum / float(tileSize.x * tileSize.y);\n        }\n    ';
    var meanTensor = makeOutput(gl, layer, [1, 1, deps.image.shape[2]]);

    return TensorProgram(SHADER, meanTensor, {
        image: deps.image,
        _activation: layer.activation
    });
}

function ExpSum(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor image;\n\n        vec4 process4(ivec4 pos) {\n            vec4 sumVal = vec4(0);\n            for(int i = 0; i < #(image.shape).z; i+=4){\n                sumVal += exp(image.read4(ivec4(0, 0, i, 0)));\n            }\n            return vec4(dot(sumVal, vec4(1)));\n        }\n    ';
    console.assert(deps.image.shape[0] == 1);
    console.assert(deps.image.shape[1] == 1);
    console.assert(deps.image.shape[3] == 1);
    var softmaxHelper = makeOutput(gl, layer, [1, 1, 4]);
    return TensorProgram(SHADER, softmaxHelper, {
        image: deps.image
    });
}

function Softmax(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor image;\n        uniform Tensor helper;\n\n        vec4 process4(ivec4 pos) {\n            return exp(image.read4(pos)) / helper.read4(ivec4(0));\n        }\n    ';
    console.assert(deps.helper.shape[0] == 1);
    console.assert(deps.helper.shape[1] == 1);
    console.assert(deps.helper.shape[2] == 4);
    console.assert(deps.helper.shape[3] == 1);

    var output = makeOutput(gl, layer, deps.image.shape);

    return TensorProgram(SHADER, output, {
        image: deps.image,
        helper: deps.helper
    });
}

function Sum(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor a;\n        uniform Tensor b;\n\n        vec4 process4(ivec4 pos) {\n            return a.read4(pos) + b.read4(pos);\n        }\n    ';
    if (deps.a.shape.some(function (k, i) {
        return k != deps.b.shape[i];
    })) throw new Error('Mismatched shapes for sum');

    var output = makeOutput(gl, layer, deps.a.shape);
    return TensorProgram(SHADER, output, {
        a: deps.a,
        b: deps.b,
        _activation: layer.activation
    });
}

function ZeroPadding2D(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor image;\n        uniform ivec2 padding;\n\n        vec4 process4(ivec4 pos) {\n            if(pos.x < padding.x || pos.y < padding.y){\n                return vec4(0, 0, 0, 0);\n            }else if(pos.x >= image.shape.x + padding.x \n                || pos.y >= image.shape.x + padding.y){\n                return vec4(0, 0, 0, 0);\n            }else{\n                return image.read4(ivec4(pos.xy - padding.xy, pos.zw));    \n            }\n        }\n    ';
    if (layer.padding.length == 2) {
        var padding = [layer.padding[0], layer.padding[0], layer.padding[1], layer.padding[1]];
    } else if (layer.padding.length == 4) {
        var padding = layer.padding;
    } else {
        throw new Error('invalid padding length');
    }
    var output = makeOutput(gl, layer, [deps.image.shape[0] + padding[0] + padding[1], deps.image.shape[1] + padding[2] + padding[3], deps.image.shape[2], deps.image.shape[3]]);
    return TensorProgram(SHADER, output, {
        image: deps.image,
        padding: layer.padding,
        _activation: layer.activation
    });
}

function Activation(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor image;\n\n        vec4 process4(ivec4 pos) {\n            return image.read4(pos);\n        }\n    ';
    console.assert(['tanh', 'relu'].includes(layer.activation));
    var output = makeOutput(gl, layer, deps.image.shape);
    return TensorProgram(SHADER, output, {
        image: deps.image,
        _activation: layer.activation
    });
}

function unsqueeze(a, axis) {
    var shape, stride;

    if (axis !== undefined && (!Number.isFinite(axis) || axis % 1 !== axis)) {
        throw new Error('axis of dimension to unsqueeze must be an integer');
    }
    axis = axis === undefined ? a.shape.length : axis;

    shape = a.shape.slice(0);
    stride = a.stride.slice(0);
    shape.splice(axis || 0, 0, 1);
    stride.splice(axis || 0, 0, (stride[axis] || 1) * (shape[axis + 1] || 1));

    return ndarray(a.data, shape, stride, a.offset);
}

function ChannelFullyConnected(gl, layer, deps) {
    var SHADER = `
    uniform Tensor image;
    uniform Tensor weights;
    uniform Tensor bias;

    vec4 process4(ivec4 pos) {
        vec4 sum = bias.read4(ivec4(0, 0, pos.z, 0));

        for(int f = 0; f < #(image.shape).z; f += 4){
            vec4 inputPix = image.read4(ivec4(0, 0, f, 0));

            sum += inputPix.r * weights.read4(ivec4(0, 0, pos.z, f + 0));
            if (f + 1 < #(image.shape).z) sum += inputPix.g * weights.read4(ivec4(0, 0, pos.z, f + 1));
            if (f + 2 < #(image.shape).z) sum += inputPix.b * weights.read4(ivec4(0, 0, pos.z, f + 2));
            if (f + 3 < #(image.shape).z) sum += inputPix.a * weights.read4(ivec4(0, 0, pos.z, f + 3));
        }
        return sum;
    }
`;


    var bias = makeTensor(gl, layer, unsqueeze(unsqueeze(layer.bias, 0), 0));

    console.assert(bias.shape[0] == 1);
    console.assert(bias.shape[1] == 1);
    console.assert(bias.shape[2] == layer.weights.shape[1]);
    // [ 1, 1, layer.bias ])


    // var myimage = makeTensor(gl, layer, unsqueeze(unsqueeze(unsqueeze(deps.image, 3), 2),1));
    var weights = makeTensor(gl, layer, unsqueeze(unsqueeze(layer.weights.transpose(1, 0), 0), 0));
    // [ 1, 1, layer.weights.shape[1], layer.weights.shape[0] ])

    console.assert(deps.image.shape[0] == 1);
    console.assert(deps.image.shape[1] == 1);
    console.assert(deps.image.shape[3] == 1);
    console.assert(deps.image.shape[2] == layer.weights.shape[0]);

    console.assert(weights.shape[0] == 1);
    console.assert(weights.shape[1] == 1);
    console.assert(weights.shape[2] == layer.weights.shape[1]);
    console.assert(weights.shape[3] == layer.weights.shape[0]);

    var output = makeOutput(gl, layer, [1, 1, layer.weights.shape[1]]);

    return TensorProgram(SHADER, output, {
        image: deps.image,
        weights: weights,
        bias: bias,
        _activation: layer.activation
    });
}

function Deconvolve2D(gl, layer, deps) {
    var SHADER = `
    uniform Tensor image;
    uniform Tensor kernel;

    uniform ivec2 imagePadding;
    uniform ivec2 imageSubsample;

    const ivec2 kernelTileSize = #(kernel.shape).xy;

    vec4 process4(ivec4 pos){
        vec4 sum = vec4(0, 0, 0, 0);

        for(int f = 0; f < #(image.shape).z ; f += 4){
            for(int kx = 0; kx < kernelTileSize.x; kx++){
                int inputX = pos.x + kx - imagePadding.x;
                if(imod(inputX, 2) != 0 || inputX < 0 || inputX >= int(image.shape.x) * 2) continue;

                for(int ky = 0; ky < kernelTileSize.y; ky++){
                    int inputY = pos.y + ky - imagePadding.y;
                    if(imod(inputY, 2) != 0 || inputY < 0 || inputY >= int(image.shape.y) * 2) continue;

                    vec4 inputPix = image.read4(ivec4(inputX / 2, inputY / 2, f, 0));

                                                sum += inputPix.r * kernel.read4(ivec4(kx, ky, pos.z, f + 0));
                    if (f+1 < #(image.shape).z) sum += inputPix.g * kernel.read4(ivec4(kx, ky, pos.z, f + 1));
                    if (f+2 < #(image.shape).z) sum += inputPix.b * kernel.read4(ivec4(kx, ky, pos.z, f + 2));
                    if (f+3 < #(image.shape).z) sum += inputPix.a * kernel.read4(ivec4(kx, ky, pos.z, f + 3));
                }
            }
        }

        return sum;
    }
`;
    
    var kernelTensor = makeTensor(gl, layer, layer.kernel.transpose(0, 1, 3, 2).step(-1, -1));

    var outputShape = [deps.image.shape[0] * layer.subsample[0], deps.image.shape[1] * layer.subsample[1], kernelTensor.shape[2]];

    var output = makeOutput(gl, layer, outputShape);
    return TensorProgram(SHADER, output, {
        image: deps.image,
        kernel: kernelTensor,
        imagePadding: layer.padding,
        imageSubsample: layer.subsample,
        _activation: layer.activation
    });
}

function SquaredResidual(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor image;\n        uniform Tensor mean;\n\n        vec4 process4(ivec4 pos){\n            vec4 tileMean = mean.read4(ivec4(0, 0, pos.z, 0));\n            vec4 pix = image.read4(pos);\n            return pow(pix - tileMean, vec4(2, 2, 2, 2));\n        }\n    ';
    console.assert(deps.mean.shape[0] == 1);
    console.assert(deps.mean.shape[1] == 1);
    console.assert(deps.image.shape[2] == deps.mean.shape[2]);

    var residualTensor = makeOutput(gl, layer, deps.image.shape);

    return TensorProgram(SHADER, residualTensor, {
        image: deps.image,
        mean: deps.mean,
        _activation: layer.activation
    });
}

function InstanceNormalize(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor image;\n        uniform Tensor mean;\n        uniform Tensor variance;\n        uniform Tensor beta;\n        uniform Tensor gamma;\n\n        const float eps = 0.00001;\n\n        vec4 process4(ivec4 pos) {\n            vec4 tileMean = mean.read4(ivec4(0, 0, pos.z, 0));\n            vec4 tileStd = vec4(eps, eps, eps, eps) + sqrt(variance.read4(ivec4(0, 0, pos.z, 0)));\n            vec4 tileBeta = beta.read4(ivec4(0, 0, pos.z, 0));\n            vec4 tileGamma = gamma.read4(ivec4(0, 0, pos.z, 0));\n            vec4 pix = image.read4(ivec4(pos.xyz, 0));\n            return (pix - tileMean) / tileStd * tileGamma + tileBeta;\n        }\n    ';

    var betaTensor = makeTensor(gl, layer, ndarray(layer.beta.data, [1, 1, layer.beta.size]));
    var gammaTensor = makeTensor(gl, layer, ndarray(layer.gamma.data, [1, 1, layer.gamma.size]));
    var normalizedTensor = makeOutput(gl, layer, deps.image.shape);

    return TensorProgram(SHADER, normalizedTensor, {
        image: deps.image,
        mean: deps.mean,
        variance: deps.variance,

        beta: betaTensor,
        gamma: gammaTensor,
        _activation: layer.activation
    });
}


function Swap(gl, layer, deps) { 
    var SHADER = `
    uniform Tensor image;
    vec4 process4(ivec4 pos) {      
        if (pos.z == 360) {
            vec4 t = image.read4(ivec4(0) );
            return vec4(image.read(ivec4(0,0,2*19*19-1, 0)), t.x, t.y, t.z );
        }
        if (pos.z < 19 * 19) {
            vec4 t  = image.read4(ivec4(0, 0, pos.z + 19*19-1, 0));
            vec4 tt  = image.read4(ivec4(0, 0, pos.z + 19*19+3, 0));
            return vec4(t.y,t.z,t.a, tt.x);
        } else {
            vec4 t  = image.read4(ivec4(0, 0, pos.z - 19*19+1, 0));
            vec4 tt  = image.read4(ivec4(0, 0, pos.z - 19*19+1-4, 0));
            return vec4(tt.a, t.x, t.y, t.z);
        }
        int p  = pos.z;
    }
    `;
    var len = deps.image.shape[2];
    
    var outputShape = [1,1,len,1];

    var output = makeOutput(gl, layer, outputShape);

    return TensorProgram(SHADER, output, {
        image: deps.image,
    });
    
}

function Flatten(gl, layer, deps) {
    var SHADER = `
    uniform Tensor image;
    ivec4 s = #(image.shape);          
    vec4 process4(ivec4 pos) {      
        /* ivec4 myvec = texture2D(image_tex, vec2(0.0, 0.0)); */
        int p  = pos.z;
        ivec4 p0 =  ivec4( p / s.z / s.y, imod(p / s.z, s.y), imod(p, s.z), 0 );
        vec4 e0 =  image.read4(p0); 
        p = p + 1;
        ivec4 p1 =  ivec4( p / s.z / s.y, imod(p / s.z, s.y), imod(p, s.z), 0 );
        vec4 e1 =  image.read4(p1); 
        p = p + 1;
        ivec4 p2 =  ivec4( p / s.z / s.y, imod(p / s.z, s.y), imod(p, s.z), 0 );
        vec4 e2 =  image.read4(p2); 
        p = p + 1;
        ivec4 p3 =  ivec4( p / s.z / s.y, imod(p / s.z, s.y), imod(p, s.z), 0 );
        vec4 e3 =  image.read4(p3); 
        if (s.z == 1) {
            return vec4( e0.x, e1.x, e2.x, e3.x);
        }
        if (s.z == 2) {
            return vec4( e0.x, e0.y, e2.x, e2.y);
        }

        if (s.z == 3) {
            return vec4( e0.x, e0.y, e0.z, e3.x);
        }

        return e0;
    } `;


    var len = deps.image.shape[0]*deps.image.shape[1]*deps.image.shape[2]*deps.image.shape[3];
    
    var outputShape = [1,1,len,1];

    var output = makeOutput(gl, layer, outputShape);

    return TensorProgram(SHADER, output, {
        image: deps.image,
    });
}



function BatchNormalize(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor image;\n        uniform Tensor beta;\n        uniform Tensor gamma;\n\n        vec4 process4(ivec4 pos) {\n            return (image.read4(ivec4(pos.xyz, 0)) + \n                beta.read4(ivec4(0, 0, pos.z, 0))) * \n                gamma.read4(ivec4(0, 0, pos.z, 0));\n        }\n    ';


    var beta = new Float32Array(layer.running_var.size),
        gamma = new Float32Array(layer.running_var.size);

    for (var i = 0; i < layer.running_var.size; i++) {
        var std_gamma = Math.sqrt(layer.running_var.get(i) + layer.epsilon);
        gamma[i] = 1 / std_gamma;
        beta[i] = -layer.running_mean.get(i) ;
    }

    // var gamma = 1 / (tileStd * tileGamma);
    // var beta = -tileMean + tileBeta * (tileStd * tileGamma)

    // (pix - tileMean + tileBeta * (tileStd * tileGamma)) / tileStd * tileGamma

    // (x - mean) / (std / gamma) + beta
    // (x - mean + beta * (std / gamma)) / (std / gamma)
    // (x + BETA) * GAMMA
    // BETA = - mean + beta * (std / gamma)
    // GAMMA = 1 / (std / gamma)

    var betaTensor = makeTensor(gl, layer, ndarray(beta, [1, 1, layer.running_var.size]));
    var gammaTensor = makeTensor(gl, layer, ndarray(gamma, [1, 1, layer.running_var.size]));
    var normalizedTensor = makeOutput(gl, layer, deps.image.shape);

    return TensorProgram(SHADER, normalizedTensor, {
        image: deps.image,
        beta: betaTensor,
        gamma: gammaTensor,
        _activation: layer.activation
    });
}

// based on: https://github.com/transcranial/keras-js/blob/master/src/layers/convolutional/Convolution2D.js

function calcOutputShape(inputShape, kernelShape) {
    var subsample = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [1, 1];
    var borderMode = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'same';

    var inputRows = inputShape[0];
    var inputCols = inputShape[1];

    var _kernelShape = _slicedToArray(kernelShape, 4),
        nbRow = _kernelShape[0],
        nbCol = _kernelShape[1],
        inputChannels = _kernelShape[2],
        outputChannels = _kernelShape[3];

    var outputRows = borderMode === 'same' ? Math.floor((inputRows + subsample[0] - 1) / subsample[0]) : Math.floor((inputRows - nbRow + subsample[0]) / subsample[0]);
    var outputCols = borderMode === 'same' ? Math.floor((inputCols + subsample[1] - 1) / subsample[1]) : Math.floor((inputCols - nbCol + subsample[1]) / subsample[1]);

    var paddingRow = borderMode === 'same' ? Math.max(0, Math.floor((outputRows - 1) * subsample[0] + nbRow - inputRows)) : 0;
    var paddingCol = borderMode === 'same' ? Math.max(0, Math.floor((outputCols - 1) * subsample[1] + nbCol - inputCols)) : 0;
    var paddingRowBefore = Math.floor(paddingRow / 2);
    var paddingRowAfter = paddingRow - paddingRowBefore;
    var paddingColBefore = Math.floor(paddingCol / 2);
    var paddingColAfter = paddingCol - paddingColBefore;

    return {
        outputShape: [outputRows, outputCols, outputChannels],
        inputPadding: [paddingRowBefore, paddingColBefore]
        // this.inputPadding = [paddingRowBefore, paddingRowAfter, paddingColBefore, paddingColAfter]
    };
}

function Convolve2D(gl, layer, deps) {
    var SHADER = `
    uniform Tensor image;
    uniform Tensor kernel;
    
    uniform ivec2 imagePadding;
    uniform ivec2 imageSubsample;

    const ivec2 kernelTileSize = #(kernel.shape).xy;

    vec4 process4(ivec4 pos){
        vec4 sum = vec4(0, 0, 0, 0);

        for(int f = 0; f < #(image.shape).z; f += 4){
            for(int kx = 0; kx < kernelTileSize.x; kx++){
                int inputX = pos.x * imageSubsample.x + kx - imagePadding.x;
                if(inputX < 0 || inputX >= int(image.shape.x)) continue;

                for(int ky = 0; ky < kernelTileSize.y; ky++){
                    int inputY = pos.y  * imageSubsample.y + ky - imagePadding.y;
                    if(inputY < 0 || inputY >= int(image.shape.y)) continue;

                    vec4 inputPix = image.read4(ivec4(inputX, inputY, f, 0));
                    
                    if (f+0 < #(image.shape).z) sum += inputPix.r * kernel.read4(ivec4(kx, ky, pos.z, f + 0));
                    if (f+1 < #(image.shape).z) sum += inputPix.g * kernel.read4(ivec4(kx, ky, pos.z, f + 1));
                    if (f+2 < #(image.shape).z) sum += inputPix.b * kernel.read4(ivec4(kx, ky, pos.z, f + 2));
                    if (f+3 < #(image.shape).z) sum += inputPix.a * kernel.read4(ivec4(kx, ky, pos.z, f + 3));
                }
            }
        }

        return sum;
    }
`;
    console.assert(layer.kernel.shape[2] == deps.image.shape[2]);
    var kernelTensor = makeTensor(gl, layer, layer.kernel.transpose(0, 1, 3, 2));

    var _calcOutputShape = calcOutputShape(deps.image.shape, [0, 1, 3, 2].map(function (k) {
        return kernelTensor.shape[k];
    }), layer.subsample, layer.border_mode),
        inputPadding = _calcOutputShape.inputPadding,
        outputShape = _calcOutputShape.outputShape;

    var outputTensor = makeOutput(gl, layer, outputShape);

    return TensorProgram(SHADER, outputTensor, {
        kernel: kernelTensor,
        image: deps.image,

        imagePadding: inputPadding,
        imageSubsample: layer.subsample,
        _activation: layer.activation
    });
}

function BiasConvolve2D(gl, layer, deps) {
    var SHADER = `
    uniform Tensor image;
    uniform Tensor kernel;
    uniform Tensor bias;

    uniform ivec2 imagePadding;
    uniform ivec2 imageSubsample;

    const ivec2 kernelTileSize = #(kernel.shape).xy;

    vec4 process4(ivec4 pos){
        vec4 sum = bias.read4(ivec4(0, 0, pos.z, 0));

        for(int f = 0; f < #(image.shape).z; f += 4){
            for(int kx = 0; kx < kernelTileSize.x; kx++){
                int inputX = pos.x * imageSubsample.x + kx - imagePadding.x;
                if(inputX < 0 || inputX >= int(image.shape.x)) continue;

                for(int ky = 0; ky < kernelTileSize.y; ky++){
                    int inputY = pos.y  * imageSubsample.y + ky - imagePadding.y;
                    if(inputY < 0 || inputY >= int(image.shape.y)) continue;

                    vec4 inputPix = image.read4(ivec4(inputX, inputY, f, 0));

                    sum += inputPix.r * kernel.read4(ivec4(kx, ky, pos.z, f + 0))
                         + inputPix.g * kernel.read4(ivec4(kx, ky, pos.z, f + 1))
                         + inputPix.b * kernel.read4(ivec4(kx, ky, pos.z, f + 2))
                         + inputPix.a * kernel.read4(ivec4(kx, ky, pos.z, f + 3));
                }
            }
        }
        return sum;
    }
`;
    
    console.assert(layer.kernel.shape[2] == deps.image.shape[2]);
    console.assert(layer.bias.shape[0] == layer.kernel.shape[3]);

    var kernelTensor = makeTensor(gl, layer, layer.kernel.transpose(0, 1, 3, 2));
    var biasTensor = makeTensor(gl, layer, ndarray(layer.bias.data, [1, 1, layer.bias.size]));

    var _calcOutputShape2 = calcOutputShape(deps.image.shape, [0, 1, 3, 2].map(function (k) {
        return kernelTensor.shape[k];
    }), layer.subsample, layer.border_mode),
        inputPadding = _calcOutputShape2.inputPadding,
        outputShape = _calcOutputShape2.outputShape;

    var outputTensor = makeOutput(gl, layer, outputShape);

    return TensorProgram(SHADER, outputTensor, {
        kernel: kernelTensor,
        bias: biasTensor,
        image: deps.image,

        imagePadding: inputPadding,
        imageSubsample: layer.subsample,
        _activation: layer.activation
    });
}

function MaxPooling2D(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor image;\n        \n        uniform ivec2 strides;\n        uniform ivec2 padding;\n\n        const ivec2 pool_size = #(_pool_size);\n\n        vec4 process4(ivec4 pos){\n            vec4 value = vec4(-10000, -10000, -10000, -10000);\n            for(int kx = 0; kx < pool_size.x; kx++){\n                int inputX = pos.x * strides.x + kx - padding.x;\n                if(inputX < 0 || inputX >= int(image.shape.x)) continue;\n                for(int ky = 0; ky < pool_size.y; ky++){\n                    int inputY = pos.y  * strides.y + ky - padding.y;\n                    if(inputY < 0 || inputY >= int(image.shape.y)) continue;\n                    value = max(value, image.read4(ivec4(inputX, inputY, pos.z, pos.w)));\n                }\n            }\n            return value;\n        }\n    ';

    var _calcOutputShape3 = calcOutputShape(deps.image.shape, [layer.pool_size[0], layer.pool_size[1], -1, deps.image.shape[2]], layer.strides, layer.border_mode),
        inputPadding = _calcOutputShape3.inputPadding,
        outputShape = _calcOutputShape3.outputShape;

    var out = makeOutput(gl, layer, outputShape);
    return TensorProgram(SHADER, out, {
        image: deps.image,

        padding: inputPadding,
        _pool_size: layer.pool_size,
        strides: layer.strides,

        _activation: layer.activation
    });
}

function AveragePooling2D(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor image;\n        \n        uniform ivec2 strides;\n        uniform ivec2 padding;\n\n        const ivec2 pool_size = #(_pool_size);\n\n        vec4 process4(ivec4 pos){\n            vec4 value = vec4(0, 0, 0, 0);\n            for(int kx = 0; kx < pool_size.x; kx++){\n                int inputX = pos.x * strides.x + kx - padding.x;\n                if(inputX < 0 || inputX >= int(image.shape.x)) continue;\n                for(int ky = 0; ky < pool_size.y; ky++){\n                    int inputY = pos.y  * strides.y + ky - padding.y;\n                    if(inputY < 0 || inputY >= int(image.shape.y)) continue;\n                    value += image.read4(ivec4(inputX, inputY, pos.z, pos.w));\n                }\n            }\n            return value / float(pool_size.x * pool_size.y);\n        }\n    ';

    var _calcOutputShape4 = calcOutputShape(deps.image.shape, [layer.pool_size[0], layer.pool_size[1], -1, deps.image.shape[2]], layer.strides, layer.border_mode),
        inputPadding = _calcOutputShape4.inputPadding,
        outputShape = _calcOutputShape4.outputShape;

    var out = makeOutput(gl, layer, outputShape);
    return TensorProgram(SHADER, out, {
        image: deps.image,

        padding: inputPadding,
        _pool_size: layer.pool_size,
        strides: layer.strides,

        _activation: layer.activation
    });
}

function ConcatChannel(gl, layer, deps) {
    var SHADER = '\n        uniform Tensor a;\n        uniform Tensor b;\n\n        vec4 process4(ivec4 pos) {\n            if(pos.z < a.shape.z){\n                return a.read4(pos);\n            }else{\n                return b.read4(ivec4(pos.xy, pos.z - a.shape.z, pos.w));\n            }\n        }\n    ';
    // the third channel must be divisible by 4 because
    // of the channel multiplexing stuff

    console.assert(deps.a.shape[2] % 4 == 0);
    console.assert(deps.b.shape[2] % 4 == 0);

    console.assert(deps.a.shape[0] == deps.b.shape[0]);
    console.assert(deps.a.shape[1] == deps.b.shape[1]);
    console.assert(deps.a.shape[3] == deps.b.shape[3]);

    var output = makeOutput(gl, layer, [deps.a.shape[0], deps.a.shape[1], deps.a.shape[2] + deps.b.shape[2], deps.a.shape[3]]);

    return TensorProgram(SHADER, output, {
        a: deps.a,
        b: deps.b,
        _activation: layer.activation
    });
}

var LAYER_TYPES = {
    InputLayer: InputLayer,
    Flatten: Flatten,
    ChannelFullyConnected: ChannelFullyConnected,
    Convolve2D: Convolve2D,
    BiasConvolve2D: BiasConvolve2D,
    Sum: Sum,
    Swap: Swap,
    ComputeMean: ComputeMean,
    ExpSum: ExpSum,
    Softmax: Softmax,
    MaxPooling2D: MaxPooling2D,
    SquaredResidual: SquaredResidual,
    ZeroPadding2D: ZeroPadding2D,
    AveragePooling2D: AveragePooling2D,
    InstanceNormalize: InstanceNormalize,
    BatchNormalize: BatchNormalize,
    Activation: Activation,
    ConcatChannel: ConcatChannel,
    Deconvolve2D: Deconvolve2D
};