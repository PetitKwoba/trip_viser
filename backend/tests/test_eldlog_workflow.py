from rest_framework.test import APITestCase, APIClient
from backend.models import User, Driver, Supervisor, Trip, ELDLog, ApprovalRequest


class ELDLogWorkflowTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        # Create driver and supervisor
        self.driver_user = User.objects.create_user(username="d1", email="d1@ex.com", password="pass1234", role='driver')
        self.sup_user = User.objects.create_user(username="s1", email="s1@ex.com", password="pass1234", role='supervisor')
        self.driver = Driver.objects.create(user=self.driver_user, license="L1", truck="T1", trailer="TR1")
        self.supervisor = Supervisor.objects.create(user=self.sup_user, office="HQ", email="s1@ex.com")
        self.driver.supervisor = self.supervisor
        self.driver.save()
        # Log in as driver
        self.client.force_authenticate(user=self.driver_user)

    def test_accept_requires_submitted_and_approved(self):
        trip = Trip.objects.create(driver=self.driver, start="A", end="B", stops=[], mileage=10)
        eld = ELDLog.objects.create(driver=self.driver, trip=trip)

        # Accept should fail without approval
        res = self.client.post(f"/api/v1/eldlogs/{eld.id}/accept/")
        self.assertEqual(res.status_code, 400)
        self.assertIn('approval', res.json().get('detail', '').lower())

        # Create approval and try again
        ApprovalRequest.objects.create(trip=trip, eldlog=eld, supervisor=self.supervisor, status='Approved')
        res = self.client.post(f"/api/v1/eldlogs/{eld.id}/accept/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['status'], 'Accepted')

        # Accept again should fail as not Submitted anymore
        res = self.client.post(f"/api/v1/eldlogs/{eld.id}/accept/")
        self.assertEqual(res.status_code, 400)

    def test_complete_requires_accepted(self):
        eld = ELDLog.objects.create(driver=self.driver)
        # Not accepted yet
        res = self.client.post(f"/api/v1/eldlogs/{eld.id}/complete/")
        self.assertEqual(res.status_code, 400)

        eld.status = 'Accepted'
        eld.save(update_fields=['status'])
        res = self.client.post(f"/api/v1/eldlogs/{eld.id}/complete/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['status'], 'Completed')


class SupervisorScopeTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        # Two drivers, one supervisor
        self.sup_user = User.objects.create_user(username="s1", email="s1@ex.com", password="pass1234", role='supervisor')
        self.supervisor = Supervisor.objects.create(user=self.sup_user, office="HQ", email="s1@ex.com")

        self.d1_user = User.objects.create_user(username="d1", email="d1@ex.com", password="pass1234", role='driver')
        self.d1 = Driver.objects.create(user=self.d1_user, license="L1", truck="T1", trailer="TR1", supervisor=self.supervisor)

        self.d2_user = User.objects.create_user(username="d2", email="d2@ex.com", password="pass1234", role='driver')
        self.d2 = Driver.objects.create(user=self.d2_user, license="L2", truck="T2", trailer="TR2")

        # Create logs
        ELDLog.objects.create(driver=self.d1)
        ELDLog.objects.create(driver=self.d2)

        # Act as supervisor
        self.client.force_authenticate(user=self.sup_user)

    def test_supervisor_can_only_view_assigned_driver_logs(self):
        # Allowed
        res1 = self.client.get(f"/api/v1/eldlogs/by-username/{self.d1_user.username}/")
        self.assertEqual(res1.status_code, 200)
        # Forbidden for unassigned driver
        res2 = self.client.get(f"/api/v1/eldlogs/by-username/{self.d2_user.username}/")
        self.assertEqual(res2.status_code, 403)