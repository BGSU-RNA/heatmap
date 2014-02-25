CSV=$(wildcard static/data/*.csv)
JSON=$(patsubst %.csv,%.json,$(CSV))
NAMES=$(notdir $(basename $(JSON)))
HEAT_JS=static/js/heatmap.js
SRC_JS=$(wildcard src/*.js)

.PHONY: test

all: js data

data: $(JSON)

static/data/%.json: bin/csv2json static/data/%.csv
	$^ > $@

test:

js: $(SRC_JS)
	cat src/start.js > $(HEAT_JS)
	grep -hv '/* globals' src/utils.js >> $(HEAT_JS)
	find src -name '*.js' -not -name 'start.js' -not -name 'stop.js' -not -name 'utils.js' | xargs grep -hv '/* globals' >> $(HEAT_JS)
	cat src/stop.js >> $(HEAT_JS)
