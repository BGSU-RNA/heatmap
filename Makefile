TSV=$(wildcard static/data/*.tsv)
JSON=$(patsubst %.tsv,%.json,$(TSV))
NAMES=$(notdir $(basename $(JSON)))

.PHONY: test deploy

all: data

data: $(JSON)

static/data/%.json: bin/csv2json static/data/%.csv
	$^ > $@

test:
