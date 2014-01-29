TSV=$(wildcard static/data/*.tsv)
JSON=$(patsubst %.tsv,%.json,$(TSV))
NAMES=$(notdir $(basename $(JSON)))

all: data

data: $(JSON)

static/data/%.json: bin/tsv2json static/data/%.tsv
	$^ > $@

test:
	echo "No tests"
