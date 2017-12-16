#include "config.h"
#ifdef USE_CUDA

#ifndef CUDA_H
#define CUDA_H

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



extern Cuda_Network cuda_net;
#endif

#endif
