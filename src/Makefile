THE_OS := $(shell uname -s)

default:
	@echo "Detected OS: ${THE_OS}"
	$(MAKE) CC=gcc CXX=g++ \
		CXXFLAGS='$(CXXFLAGS) -Wall -Wextra -pipe -O3 -g -ffast-math -flto -march=native -std=c++14 -DNDEBUG'  \
		LDFLAGS='$(LDFLAGS) -flto -g' \
		leelaz -L/Users/xcode/homebrew/lib

debug:
	@echo "Detected OS: ${THE_OS}"
	$(MAKE) CC=gcc CXX=g++ \
		CXXFLAGS='$(CXXFLAGS) -Wall -Wextra -pipe -Og -g -std=c++14' \
		LDFLAGS='$(LDFLAGS) -g' \
		leelaz

clang:
	$(MAKE) CC=clang CXX=clang++ \
		CXXFLAGS='$(CXXFLAGS) -Wall -Wextra -Wno-missing-braces -O3 -ffast-math -flto -march=native -std=c++14 -DNDEBUG' \
		LDFLAGS='$(LDFLAGS) -flto -fuse-linker-plugin' \
		leelaz

webgl:
	$(MAKE) CC=emcc CXX=em++ \
		CXXFLAGS='$(CXXFLAGS) -Wall -Wextra -pipe -O3 -g -ffast-math -flto -std=c++14 -DNDEBUG'  \
		LDFLAGS='$(LDFLAGS) -flto -g' \
		leelazjs

DYNAMIC_LIBS = -lboost_program_options -lpthread -lz -L/Users/xcode/homebrew/lib
LIBS =

ifeq ($(THE_OS),Linux)
# for Linux with OpenBLAS
# CXXFLAGS += -I/usr/include/openblas
# DYNAMIC_LIBS += -lopenblas
# DYNAMIC_LIBS += -lOpenCL

# for macOS (comment out the Linux part)
	LIBS += -framework Accelerate
	LIBS += -framework OpenCL
	CXXFLAGS += -I/System/Library/Frameworks/Accelerate.framework/Versions/Current/Headers
endif

# for MKL instead of OpenBLAS
#DYNAMIC_LIBS += -lmkl_rt
#CXXFLAGS += -I/opt/intel/mkl/include
#LDFLAGS  += -L/opt/intel/mkl/lib/intel64/

# for WebGL (comment out the Linux part)
CXXFLAGS += -I/Users/xcode/homebrew/include -I./zlib

CXXFLAGS += -I.
CPPFLAGS += -MD -MP

sources = Network.cpp FullBoard.cpp KoState.cpp Training.cpp \
	  TimeControl.cpp UCTSearch.cpp GameState.cpp Leela.cpp \
	  SGFParser.cpp Timing.cpp Utils.cpp FastBoard.cpp \
	  SGFTree.cpp Zobrist.cpp FastState.cpp GTP.cpp Random.cpp \
	  SMP.cpp UCTNode.cpp OpenCL.cpp TTable.cpp

objects = $(sources:.cpp=.o)
deps = $(sources:%.cpp=%.d)

-include $(deps)

%.o: %.cpp
	$(CXX) $(CXXFLAGS) $(CPPFLAGS) -c -o $@ $<

leelaz: $(objects)
	$(CXX) $(LDFLAGS) -o $@ $^ $(LIBS) $(DYNAMIC_LIBS)

leelazjs: $(objects)
	$(CXX) $(LDFLAGS) -o leelaz.html $^ $(LIBS) $(DYNAMIC_LIBS) program_options/src/*.o zlib/*.o -O3 -s DEMANGLE_SUPPORT=1 -s DISABLE_EXCEPTION_CATCHING=2 -s ASSERTIONS=2 -s ALLOW_MEMORY_GROWTH=0 -s EXPORTED_FUNCTIONS="['_set_input_buffer','_set_output_buffer', '_main', '_sendcmd', '_set_file_buffer']"  -s TOTAL_MEMORY=160MB -s WASM=1 -s "BINARYEN_METHOD='native-wasm,asmjs'"

clean:
	-$(RM) leelaz $(objects) $(deps)

.PHONY: clean default debug clang
