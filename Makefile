CSV=$(wildcard static/data/*.csv)
JSON=$(patsubst %.csv,%.json,$(CSV))
NAMES=$(notdir $(basename $(JSON)))

.PHONY: test deploy

all: data

data: $(JSON)

static/data/%.json: bin/tsv2json static/data/%.csv
	$^ > $@

test:
