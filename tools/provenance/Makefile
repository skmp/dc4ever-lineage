# build: make -C tools/provenance frames ; run: make -C tools/provenance run-frames (about 30 s)
# provenance.cpp is the superseded 48-snapshot tool (its output is data-v1/; inputs from tools/prov_prep.py)
CXX ?= g++
ROOT := $(abspath ../..)
provenance: provenance.cpp
	$(CXX) -O2 -march=native -std=c++20 -fopenmp -o $@ $< -lz
frames: frames.cpp
	$(CXX) -O2 -march=native -std=c++20 -fopenmp -o $@ $< -lz
run-frames: frames
	python3 $(ROOT)/tools/frames.py
	OMP_NUM_THREADS=16 ./frames $(ROOT)/agents/frames/work $(ROOT)/repos $(ROOT)/data
	python3 $(ROOT)/tools/frames_manifest.py
	python3 $(ROOT)/tools/viewer_prep.py
	python3 $(ROOT)/tools/frames_manifest.py --sizes
.PHONY: run-frames
