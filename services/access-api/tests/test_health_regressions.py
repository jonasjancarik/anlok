import unittest

from fastapi.testclient import TestClient

import api


class HealthRegressionTests(unittest.TestCase):
    def test_health_is_available_without_authentication(self):
        response = TestClient(api.app).get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
