CSV=$(wildcard raw/*_data.txt)
JSON=$(patsubst raw/%_data.txt,static/data/%.json,$(CSV))
NAMES=$(notdir $(basename $(JSON)))
HEAT_JS=static/js/heatmap.js
HEAT_SRC=$(wildcard src/heatmap/*.js)

.PHONY: test

all: js data img

data: $(JSON)

img:
	bin/move-images raw

static/data/%.json: bin/csv2json raw/%_data.txt
	$^ > $@

test:

js: $(HEAT_JS)
	
$(HEAT_JS): $(HEAT_SRC)
	cat src/heatmap/start.js > $(HEAT_JS)
	grep -hv '/* globals' src/heatmap/utils.js >> $(HEAT_JS)
	find src -name '*.js' -not -name 'start.js' -not -name 'stop.js' -not -name 'utils.js' | xargs grep -hv '/* globals' >> $(HEAT_JS)
	cat src/heatmap/stop.js >> $(HEAT_JS)
