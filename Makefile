# Common tasks for Trip Viser

.PHONY: install-backend install-frontend dev-backend dev-frontend test-backend lint-frontend build-frontend collectstatic update-readme-badges

install-backend:
	python -m pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

dev-backend:
	python manage.py runserver 127.0.0.1:8000

dev-frontend:
	cd frontend && npm start

test-backend:
	python manage.py test backend -v 2

lint-frontend:
	cd frontend && npx eslint src --ext .js,.jsx || exit 0

build-frontend:
	cd frontend && npm run build

collectstatic:
	python manage.py collectstatic --noinput

update-readme-badges:
	python scripts/update_readme_badges.py
