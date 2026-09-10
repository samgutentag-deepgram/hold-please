.PHONY: install dev start check test clean

install:
	pnpm install

dev:
	npm run dev

start:
	npm start

check:
	npm run typecheck

test:
	npm test

clean:
	rm -rf node_modules
