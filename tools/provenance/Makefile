# build: make -C tools/provenance ; run: make -C tools/provenance run
CXX ?= g++
ROOT := $(abspath ../..)
provenance: provenance.cpp
	$(CXX) -O2 -march=native -std=c++20 -fopenmp -o $@ $< -lz
run: provenance
	python3 $(ROOT)/tools/prov_prep.py
	OMP_NUM_THREADS=16 ./provenance $(ROOT)/agents/provenance/work $(ROOT)/repos $(ROOT)/data
	python3 $(ROOT)/tools/prov_manifest.py
.PHONY: run
