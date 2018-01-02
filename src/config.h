/*
    This file is part of Leela Zero.

    Leela Zero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Leela Zero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Leela Zero.  If not, see <http://www.gnu.org/licenses/>.
*/

#ifndef CONFIG_INCLUDED
#define CONFIG_INCLUDED

/*
 * We need to check for input while we are thinking.
 * That code isn't portable, so select something appropriate for the system.
 */
#ifdef _WIN32
#undef HAVE_SELECT
#define NOMINMAX
#else
#define HAVE_SELECT
#endif

/* Features */
//#define USE_BLAS
//#define USE_OPENBLAS
//#define USE_MKL
//#define USE_OPENCL
//#define USE_TUNER
#define USE_IPC
// Remember to turn on USE_BLAS, USE_OPENBLAS and USE_OPENCL when using USE_IPC_TEST
//#define USE_IPC_TEST

#ifdef USE_IPC_TEST
    #if !defined(USE_OPENCL) || !defined(USE_BLAS)
        #error Must Define USE_OPENCL and USE_BLAS with USE_IPC_TEST
    #elif defined(__linux__) && !defined(USE_OPENBLAS)
        #error Must enable USE_OPENBLAS on linux systems
    #endif
#endif


#define PROGRAM_NAME "Leela Zero"
#define PROGRAM_VERSION "0.9"

// OpenBLAS limitation
// #if defined(USE_BLAS) && defined(USE_OPENBLAS)
// #define MAX_CPUS 64
// #else
// #define MAX_CPUS 128
// #endif

#define MAX_CPUS 1

#ifdef USE_HALF
#ifndef USE_OPENCL
#error "Half-precision not supported without OpenCL"
#endif
#include "half/half.hpp"
using net_t = half_float::half;
#else
using net_t = float;
#endif

#if defined(USE_BLAS) && defined(USE_OPENCL) && !defined(USE_HALF)
// If both BLAS and OpenCL are fully usable, then check the OpenCL
// results against BLAS with some probability.
#define USE_OPENCL_SELFCHECK
#define SELFCHECK_PROBABILITY 2000
#endif

#if (_MSC_VER >= 1400) /* VC8+ Disable all deprecation warnings */
    #pragma warning(disable : 4996)
#endif /* VC8+ */

#endif
