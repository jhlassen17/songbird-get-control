xpi:
	rm -f *.xpi
	ls -1 | grep -v '\.xpi' | xargs zip irank.xpi

