"""Thin client for the admin-only report endpoints of the Coffer backend (api/Admin/Reports)."""
import requests


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


class AdminApi:
    def __init__(self, base_url, token, session=None, timeout=10):
        self.base_url = (base_url or "").rstrip("/")
        self.token = (token or "").strip()
        self.session = session or requests.Session()
        self.timeout = timeout

    # ------------------------------------------------------------------ endpoints

    def rules(self):
        return self._json("GET", "/api/Reports/Rules")

    def list_reports(self, status=None, target_type=None):
        params = {}
        if status:
            params["status"] = status
        if target_type:
            params["targetType"] = target_type
        return self._json("GET", "/api/Admin/Reports", params=params)

    def get_report(self, report_id):
        return self._json("GET", f"/api/Admin/Reports/{report_id}")

    def resolve(self, report_id, decision, rule, statement):
        body = {"decision": decision, "rule": rule, "statement": statement}
        return self._json("POST", f"/api/Admin/Reports/{report_id}/Resolve", json=body)

    def listing_image(self, file_name):
        return self._request("GET", f"/api/Listings/Image/{file_name}").content

    # ------------------------------------------------------------------ plumbing

    def _json(self, method, path, params=None, json=None):
        return self._request(method, path, params=params, json=json).json()

    def _request(self, method, path, params=None, json=None):
        try:
            response = self.session.request(
                method,
                f"{self.base_url}{path}",
                headers={"Authorization": f"Bearer {self.token}"},
                params=params,
                json=json,
                timeout=self.timeout,
            )
        except requests.RequestException as e:
            raise ApiError(0, f"Can't reach the API: {e}") from e

        if not response.ok:
            raise ApiError(response.status_code, self._error_message(response))
        return response

    @staticmethod
    def _error_message(response):
        try:
            message = response.json().get("message")
        except ValueError:
            message = None
        if message:
            return message
        if response.status_code == 401:
            return "Not signed in: the admin token is missing, invalid or expired."
        if response.status_code == 403:
            return "This account is not an admin."
        return f"Request failed (HTTP {response.status_code})."
