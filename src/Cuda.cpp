#include <algorithm>
#include <functional>
#include <cassert>
#include <iostream>
#include <fstream>
#include <sstream>
#include <iterator>
#include <string>
#include <memory>
#include <cmath>
#include <array>
#include <thread>
#include <vector>
#include <cstdio>

extern "C" {
#include "darknet/include/darknet.h"
#include <assert.h>
#include <math.h>
#include <unistd.h>
}

// Input + residual block tower
static std::vector<std::vector<float>> conv_weights;
static std::vector<std::vector<float>> conv_biases;
static std::vector<std::vector<float>> batchnorm_means;
static std::vector<std::vector<float>> batchnorm_variances;

// Policy head
static std::vector<float> conv_pol_w;
static std::vector<float> conv_pol_b;
static std::array<float, 2> bn_pol_w1;
static std::array<float, 2> bn_pol_w2;

static std::array<float, 261364> ip_pol_w;
static std::array<float, 362> ip_pol_b;

// Value head
static std::vector<float> conv_val_w;
static std::vector<float> conv_val_b;
static std::array<float, 1> bn_val_w1;
static std::array<float, 1> bn_val_w2;

static std::array<float, 92416> ip1_val_w;
static std::array<float, 256> ip1_val_b;

static std::array<float, 256> ip2_val_w;
static std::array<float, 1> ip2_val_b;

std::string cfg_weightsfile;

class Cuda_Network {
public:
    void initialize();
    // void ensure_thread_initialized(void);
    // std::string get_device_name();
    // void forward(const std::vector<float>& input, std::vector<float>& output);
    network * darknet;

private:
    // nothing
};


std::string generate_conv(int kernel_size, int input_size, int output_size) {


}

void Cuda_Network::initialize() {
    std::string cfg = std::string();
    cfg.append("[net]\nbatch=1\nsubdivisions=1\nheight=19\nwidth=19\nchannels=18\nmomentum=0.9\ndecay=0.0005\n\n");

    char buff[300];


    char * file_name = std::tmpnam(nullptr);

    // sprintf(buff, "[convolutional]\nfilter=%d\nsize=%d\nstride=1\n"
    //               "pad=%d\nactivation=relu\nbatch_normalized=1\n\n", 
    //               num_channels, 3, 1);
    // cfg.append(buff);
    // std::ofstream out(cfg_file_name);
    // out << cfg;
    // out.close();

    // darknet = parse_network_cfg(cfg_file_name);
    darknet = parse_network_cfg("darknet.cfg");


    // Count size of the network
    printf("Detecting residual layers...");
    std::ifstream wtfile(cfg_weightsfile);
    if (wtfile.fail()) {
        printf("Could not open weights file: %s\n", cfg_weightsfile.c_str());
        exit(EXIT_FAILURE);
    }
    std::string line;
    auto linecount = size_t{0};
    auto format_version = -1;
    int num_channels = -1;

    while (std::getline(wtfile, line)) {
        std::stringstream iss(line);
        // First line is the file format version id
        if (linecount == 0) {
           iss >> format_version;
           printf("v%d...", format_version);
        }
        // Third line of parameters are the convolution layer biases,
        // so this tells us the amount of channels in the residual layers.
        // (Provided they're all equally large - that's not actually required!)
        if (linecount == 2) {
            auto count = std::distance(std::istream_iterator<std::string>(iss),
                                       std::istream_iterator<std::string>());
            printf("%d channels...", count);
            num_channels = count;
        }
        linecount++;
    }
    // 1 format id, 1 input layer (4 x weights), 14 ending weights,
    // the rest are residuals, every residual has 8 x weight lines
    auto residual_blocks = linecount - (1 + 4 + 14);
    if (residual_blocks % 8 != 0) {
        printf("\nInconsistent number of weights in the file.\n");
        exit(EXIT_FAILURE);
    }
    residual_blocks /= 8;
    printf("%d blocks\n", residual_blocks);
    // Re-read file and process
    wtfile.clear();
    wtfile.seekg(0, std::ios::beg);

    // Get the file format id out of the way
    std::getline(wtfile, line);

    auto plain_conv_layers = 1 + (residual_blocks * 2);
    auto plain_conv_wts = plain_conv_layers * 4;
    linecount = 0;
    while (std::getline(wtfile, line)) {
        std::vector<float> weights;
        float weight;
        std::istringstream iss(line);
        while (iss >> weight) {
            weights.emplace_back(weight);
        }
        if (linecount < plain_conv_wts) {
            if (linecount % 4 == 0) {
                conv_weights.emplace_back(weights);
            } else if (linecount % 4 == 1) {
                conv_biases.emplace_back(weights);
            } else if (linecount % 4 == 2) {
                batchnorm_means.emplace_back(weights);
            } else if (linecount % 4 == 3) {
                batchnorm_variances.emplace_back(weights);
            }
        } else if (linecount == plain_conv_wts) {
            conv_pol_w = std::move(weights);
        } else if (linecount == plain_conv_wts + 1) {
            conv_pol_b = std::move(weights);
        } else if (linecount == plain_conv_wts + 2) {
            std::copy(begin(weights), end(weights), begin(bn_pol_w1));
        } else if (linecount == plain_conv_wts + 3) {
            std::copy(begin(weights), end(weights), begin(bn_pol_w2));
        } else if (linecount == plain_conv_wts + 4) {
            std::copy(begin(weights), end(weights), begin(ip_pol_w));
        } else if (linecount == plain_conv_wts + 5) {
            std::copy(begin(weights), end(weights), begin(ip_pol_b));
        } else if (linecount == plain_conv_wts + 6) {
            conv_val_w = std::move(weights);
        } else if (linecount == plain_conv_wts + 7) {
            conv_val_b = std::move(weights);
        } else if (linecount == plain_conv_wts + 8) {
            std::copy(begin(weights), end(weights), begin(bn_val_w1));
        } else if (linecount == plain_conv_wts + 9) {
            std::copy(begin(weights), end(weights), begin(bn_val_w2));
        } else if (linecount == plain_conv_wts + 10) {
            std::copy(begin(weights), end(weights), begin(ip1_val_w));
        } else if (linecount == plain_conv_wts + 11) {
            std::copy(begin(weights), end(weights), begin(ip1_val_b));
        } else if (linecount == plain_conv_wts + 12) {
            std::copy(begin(weights), end(weights), begin(ip2_val_w));
        } else if (linecount == plain_conv_wts + 13) {
            std::copy(begin(weights), end(weights), begin(ip2_val_b));
        }
        linecount++;
    }
    wtfile.close();


    FILE *fp = fopen(file_name, "wb");

    int major = 0;
    int minor = 2;
    int revision = 0;
    fwrite(&major, sizeof(int), 1, fp);
    fwrite(&minor, sizeof(int), 1, fp);
    fwrite(&revision, sizeof(int), 1, fp);
    fwrite(darknet->seen, sizeof(size_t), 1, fp);

    std::vector<float> scale(1000, 1.0f);

    for (auto i = 0; i< conv_biases.size(); i++) {
        printf("%d - %d - %d - %d\n", conv_biases[i].size(), batchnorm_means[i].size(), batchnorm_variances[i].size(), conv_weights[i].size());
        fwrite(conv_biases[i].data(), sizeof(float), conv_biases[i].size(), fp);
        fwrite(scale.data(), sizeof(float),          conv_biases[i].size(), fp);
        fwrite(batchnorm_means[i].data(), sizeof(float),     batchnorm_means[i].size(), fp);
        fwrite(batchnorm_variances[i].data(), sizeof(float), batchnorm_variances[i].size(), fp);
        fwrite(conv_weights[i].data(), sizeof(float),        conv_weights[i].size(), fp);
    }

    // policy head
    printf("conv pol b %f\n", conv_pol_b[0]);
    printf("conv pol b %f\n", conv_pol_b[1]);
    fwrite(conv_pol_b.data(), sizeof(float), conv_pol_b.size(), fp);
    fwrite(scale.data(),      sizeof(float), conv_pol_b.size(), fp);
    fwrite(bn_pol_w1.data(), sizeof(float), bn_pol_w1.size(), fp);
    fwrite(bn_pol_w2.data(), sizeof(float), bn_pol_w2.size(), fp);
    fwrite(conv_pol_w.data(), sizeof(float), conv_pol_w.size(), fp);
    printf("%d - %d - %d - %d\n", conv_pol_b.size(), bn_pol_w1.size(), bn_pol_w2.size(), conv_pol_w.size());

    fwrite(ip_pol_b.data(), sizeof(float), ip_pol_b.size(), fp);
    fwrite(ip_pol_w.data(), sizeof(float), ip_pol_w.size(), fp);
    printf("%d - %d\n", ip_pol_b.size(), ip_pol_w.size());

    // value head
    fwrite(conv_val_b.data(), sizeof(float), conv_val_b.size(), fp);
    fwrite(scale.data(), sizeof(float), conv_val_b.size(), fp);
    fwrite(bn_val_w1.data(), sizeof(float), bn_val_w1.size(), fp);
    fwrite(bn_val_w2.data(), sizeof(float), bn_val_w2.size(), fp);
    fwrite(conv_val_w.data(), sizeof(float), conv_val_w.size(), fp);

    fwrite(ip1_val_b.data(), sizeof(float), ip1_val_b.size(), fp);
    fwrite(ip1_val_w.data(), sizeof(float), ip1_val_w.size(), fp);

    fwrite(ip2_val_b.data(), sizeof(float), ip2_val_b.size(), fp);
    fwrite(ip2_val_w.data(), sizeof(float), ip2_val_w.size(), fp);

    printf("%f\n", ip2_val_b[0]);

    fclose(fp);

    load_weights(darknet, file_name);
    std::vector<float> myinp(19*19*18);
    for (int i =0; i < 19*19*18; i++) { myinp[i] = cos(i); }
    float *out = network_predict(darknet, myinp.data());
    float s = 0.0;
    for (int i = 0; i < 19*19+1; i++) {
        printf("%f  ", out[i]);
        s += out[i];
    }
    printf("winrate: %f\n", 1.0 + out[19*19+1]/2.0);
    printf("sum_out: %f\n", s);
    printf("last: %f\n", out[19*19-1]);
    printf("first: %f\n", out[0]);

    printf("done\n");
}

int main() {
    cfg_weightsfile = std::string("4e4d09bee37ab25f68ba8fdf44312f93eb2d317d88ec6b93250505d5d67fd7f6");
    Cuda_Network net;

    net.initialize();
    return 0;
}

