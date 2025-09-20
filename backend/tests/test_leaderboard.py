from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from backend.models import User, Driver


class LeaderboardAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        # Create users and drivers with varying mileage
        self.users = []
        self.drivers = []
        mileage_list = [1500, 1400, 1300, 1200, 1100, 1000, 900]
        for i, miles in enumerate(mileage_list, start=1):
            u = User.objects.create_user(username=f"driver{i}", email=f"driver{i}@ex.com", password="pass1234", role='driver')
            d = Driver.objects.create(user=u, license=f"LIC{i}", truck=f"T{i}", trailer=f"TR{i}", mileage=miles)
            self.users.append(u)
            self.drivers.append(d)

        # Auth as driver7 (outside top 5)
        self.me_user = self.users[-1]
        self.client.force_authenticate(user=self.me_user)

    def test_leaderboard_top5_and_me(self):
        url = "/api/v1/drivers/leaderboard/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('top', data)
        self.assertIn('me', data)
        self.assertEqual(len(data['top']), 5)
        # Top should start at 1500 down to 1100
        top_miles = [item['mileage'] for item in data['top']]
        self.assertEqual(top_miles, [1500, 1400, 1300, 1200, 1100])
        # 'me' exists and rank should be 6 or 7 depending on distribution (here 7 with 900)
        self.assertIsNotNone(data['me'])
        self.assertEqual(data['me']['username'], self.me_user.username)
        self.assertEqual(data['me']['mileage'], 900)
        self.assertGreaterEqual(data['me']['rank'], 6)

    def test_leaderboard_me_in_top_is_null(self):
        # Authenticate as top driver (driver1)
        self.client.force_authenticate(user=self.users[0])
        res = self.client.get("/api/v1/drivers/leaderboard/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsNone(data['me'])
