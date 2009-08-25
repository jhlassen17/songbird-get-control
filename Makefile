name=get-control
xpi:
	rm -f *.xpi
	ls -1 | grep -v '\.xpi' | xargs zip $(name).xpi

