from django.test import TestCase, Client, override_settings
from .models import User, Driver, Supervisor, Trip, ELDLog, ApprovalRequest

class BasicModelTests(TestCase):
    def test_user_creation(self):
        user = User.objects.create_user(username='testuser', email='test@example.com', password='password', role='driver')
        self.assertEqual(user.role, 'driver')
        self.assertEqual(user.email, 'test@example.com')

    def test_driver_creation(self):
        user = User.objects.create_user(username='driver1', email='driver1@example.com', password='password', role='driver')
        driver = Driver.objects.create(user=user, license='A1234567', truck='Truck 12', trailer='Trailer 7')
        self.assertEqual(driver.license, 'A1234567')
        self.assertEqual(driver.user.username, 'driver1')

    def test_supervisor_creation(self):
        user = User.objects.create_user(username='supervisor1', email='supervisor1@example.com', password='password', role='supervisor')
        supervisor = Supervisor.objects.create(user=user, office='Main Office', email='supervisor1@example.com')
        self.assertEqual(supervisor.office, 'Main Office')
        self.assertEqual(supervisor.user.username, 'supervisor1')


class RootEndpointTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_root_landing_page_when_no_frontend_url(self):
        resp = self.client.get('/')
        self.assertEqual(resp.status_code, 200)
        content = resp.content.decode('utf-8')
        self.assertIn('/api/health/', content)
        self.assertIn('/api/schema/', content)
        self.assertIn('/admin/', content)

    @override_settings(FRONTEND_URL='https://example-frontend.local')
    def test_root_redirects_when_frontend_url_set(self):
        resp = self.client.get('/')
        self.assertIn(resp.status_code, (301, 302))
        self.assertEqual(resp.headers.get('Location'), 'https://example-frontend.local')
