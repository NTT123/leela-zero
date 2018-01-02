import time
import mmap
import os
import sys

import posix_ipc as ipc
import numpy as np

BOARD_SIZE = 19
BOARD_SQUARES = BOARD_SIZE ** 2
INPUT_CHANNELS = 18
SIZE_OF_FLOAT = 4
SIZE_OF_INT = 4

# prob of each move + prob of pass + eval of board position
OUTPUT_PREDICTIONS = BOARD_SQUARES + 2

INSTANCE_INPUTS       = INPUT_CHANNELS * BOARD_SQUARES
INSTANCE_INPUT_SIZE   = SIZE_OF_FLOAT * INSTANCE_INPUTS
INSTANCE_OUTPUT_SIZE  = SIZE_OF_FLOAT * OUTPUT_PREDICTIONS


def roundup(size, page_size):
    return size + size * (size % page_size > 0)


def createSMP(name):
    smp = ipc.Semaphore(name, ipc.O_CREAT)
    # unlink semaphore so it is deleted when the program exits
    smp.unlink()
    return ipc.Semaphore(name, ipc.O_CREAT)


def createCounters(leename, num_instances):
    smp_counter =  createSMP("/%s_counter" % leename) # counter semaphore

    smpA = []
    smpB = []
    for i in range(num_instances):
        # two semaphores for each instance (input ready, output ready)
        smpA.append(createSMP("/%s_A_%d" % (leename, i)))
        smpB.append(createSMP("/%s_B_%d" % (leename,i)))

    return smp_counter, smpA, smpB


def setupMemory(leename, num_instances):
    mem_name = "/sm" + leename  # shared memory name
    # 2 counters + num_instance * (input + output)
    counter_size = 2 + num_instances
    total_input_size  = num_instances * INSTANCE_INPUT_SIZE
    extra_size = 8
    total_output_size = num_instances * INSTANCE_OUTPUT_SIZE

    needed_memory_size = counter_size + total_input_size + extra_size + total_output_size
    shared_memory_size = roundup(needed_memory_size, ipc.PAGE_SIZE)

    try:
        sm = ipc.SharedMemory(mem_name, flags=0, size=shared_memory_size)
    except Exception as ex:
        sm = ipc.SharedMemory(mem_name, flags=ipc.O_CREAT, size=shared_memory_size)

    # memory layout of the shared memory:
    # | counter counter | bit mask 1 | bit mask 2 | ... | input 1 | input 2 | ... | output 1 | output 2 | ... |

    mem = mmap.mmap(sm.fd, sm.size)
    sm.close_fd()

    # Set up aliased names for the shared memory
    mv  = np.frombuffer(mem, dtype=np.uint8, count=needed_memory_size);
    counter    = mv[:counter_size]
    input_mem  = mv[counter_size:counter_size + total_input_size]
    output_mem = mv[counter_size + total_input_size + extra_size:]

    # reset all shared memory
    mv[:] = 0

    return counter, input_mem, output_mem


def main():
    leename = os.environ.get("LEELAZ", "lee")
    print("Using batch name: ", leename)

    num_instances = int(sys.argv[1])
    realbs = int(sys.argv[2])               # real batch size

    if num_instances % realbs != 0:
        print("Error: number of instances isn't divisible by batch size")
        sys.exit(-1)
    else:
        print("%d instances using batch size %d" % (num_instances, realbs))

    counter, input_mem, output_mem = setupMemory(leename, num_instances)
    smp_counter, smpA, smpB = createCounters(leename, num_instances)

    import nn # import our neural network

    counter[0] = num_instances // 256   # num_instances = counter0 * 256 + counter1
    counter[1] = num_instances %  256

    smp_counter.release() # now clients can take this semaphore

    print("Waiting for %d autogtp instances to run" % num_instances)

    net = nn.net
    import gc
    import time

    #t2 = time.perf_counter()
    numiter = num_instances // realbs
    while True:
        for ii in range(numiter):
            start_instance = ii * realbs
            end_instance   = start_instance + realbs
            # print(c)

            # wait for data
            for i in range(realbs):
                smpB[start_instance + i].acquire()

            #t1 = time.perf_counter()
            #print("delta t1 = ", t1 - t2)
            #t1 = time.perf_counter()

            start_input = start_instance * INSTANCE_INPUT_SIZE
            end_input   = end_instance  * INSTANCE_INPUT_SIZE
            dt = np.frombuffer(input_mem[start_input:end_input],
                               dtype=np.float32,
                               count=INSTANCE_INPUTS)

            nn.netlock.acquire(True)   # BLOCK HERE
            if nn.newNetWeight != None:
                nn.net = None
                gc.collect()  # hope that GPU memory is freed, not sure :-()
                weights, numBlocks, numFilters = nn.newNetWeight
                print(" %d channels and %d blocks" % (numFilters, numBlocks) )
                nn.net = nn.LZN(weights, numBlocks, numFilters)
                net = nn.net
                print("...updated weight!")
                nn.newNetWeight = None
            nn.netlock.release()


            net[0].set_value(dt.reshape( (realbs, 18, 19, 19) ) )

            qqq = net[1]().astype(np.float32)
            ttt = qqq.reshape(realbs * (19*19+2))

            start_output = start_instance * INSTANCE_OUTPUT_SIZE
            end_output = end_instance * INSTANCE_OUTPUT_SIZE
            output_mem[start_output:end_output] = ttt.view(dtype=np.uint8)

            for i in range(realbs):
                smpA[start_instance + i].release() # send result to client

            #t2 = time.perf_counter()
            #print("delta t2 = ", t2- t1)
            #t2 = time.perf_counter()
        
        # wait till all clients connected
        counter[2:] = 0 # reset bit masks

if __name__ == "__main__":
    if len(sys.argv) != 3 :
        print("Usage: %s num-instances batch-size" % sys.argv[0])
        sys.exit(-1)

    main()


