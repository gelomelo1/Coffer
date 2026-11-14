"""Clients for the Coffer backend used by Coffer.Manager.

ManagerAuth  - GitHub device-flow sign-in brokered by the backend (api/Manager/Auth/*); the GitHub token never
               reaches this app, only a short-lived Manager token for configured administrators.
AdminApi     - the admin-only endpoints (api/Admin/*). Every call needs that Manager token; the backend enforces
               the administrator check on each request.
"""
import requests


class ApiError(Exception):
    def __init__(self, status, message, code=None):
        super().__init__(message)
        self.status = status
        self.code = code


class _Client:
    def __init__(self, base_url, token=None, session=None, timeout=15):
        self.base_url = (base_url or "").rstrip("/")
        self.token = (token or "").strip()
        self.session = session or requests.Session()
        self.timeout = timeout

    def _json(self, method, path, params=None, json=None):
        response = self._request(method, path, params=params, json=json)
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    def _request(self, method, path, params=None, json=None):
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        try:
            response = self.session.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                params=params,
                json=json,
                timeout=self.timeout,
            )
        except requests.RequestException as e:
            raise ApiError(0, f"Can't reach the API: {e}") from e

        if not response.ok:
            message, code = self._error(response)
            raise ApiError(response.status_code, message, code)
        return response

    @staticmethod
    def _error(response):
        try:
            body = response.json()
        except ValueError:
            body = None
        message = body.get("message") if isinstance(body, dict) else None
        code = body.get("code") if isinstance(body, dict) else None
        if message:
            return message, code
        if response.status_code == 401:
            return "Not signed in: the Manager session is missing or expired. Sign in again.", code
        if response.status_code == 403:
            return "This GitHub account is not a Coffer administrator.", code
        return f"Request failed (HTTP {response.status_code}).", code


class ManagerAuth(_Client):
    """GitHub device flow: start() -> show user_code, open verification_uri; poll(device_code) until authorized."""

    def start(self):
        return self._json("POST", "/api/Manager/Auth/Device")

    def poll(self, device_code):
        return self._json("POST", "/api/Manager/Auth/Device/Token", json={"deviceCode": device_code})

    def me(self):
        return self._json("GET", "/api/Manager/Auth/Me")


def _params(**values):
    return {k: v for k, v in values.items() if v not in (None, "", "all")}


class AdminApi(_Client):
    # ------------------------------------------------------------------ reports (individual)

    def rules(self):
        return self._json("GET", "/api/Admin/Reports/Rules")

    def list_reports(self, status=None, target_type=None, page=1, page_size=100):
        return self._json("GET", "/api/Admin/Reports",
                          params=_params(status=status, targetType=target_type, page=page, pageSize=page_size))

    def get_report(self, report_id):
        return self._json("GET", f"/api/Admin/Reports/{report_id}")

    def resolve(self, report_id, decision, rule, statement, suspension_hours=None):
        body = {"decision": decision, "rule": rule, "statement": statement, "suspensionHours": suspension_hours}
        return self._json("POST", f"/api/Admin/Reports/{report_id}/Resolve", json=body)

    def resolve_many(self, report_ids, decision, rule, statement, suspension_hours=None):
        body = {"reportIds": list(report_ids), "decision": decision, "rule": rule, "statement": statement,
                "suspensionHours": suspension_hours}
        return self._json("POST", "/api/Admin/Reports/Resolve", json=body)

    # ------------------------------------------------------------------ reported content (grouped)

    def list_content(self, status=None, target_type=None, page=1, page_size=100):
        return self._json("GET", "/api/Admin/ReportedContent",
                          params=_params(status=status, targetType=target_type, page=page, pageSize=page_size))

    def get_content(self, target_type, target_id):
        return self._json("GET", f"/api/Admin/ReportedContent/{target_type}/{target_id}")

    def resolve_content(self, target_type, target_id, decision, rule, statement, suspension_hours=None):
        body = {"decision": decision, "rule": rule, "statement": statement, "suspensionHours": suspension_hours}
        return self._json("POST", f"/api/Admin/ReportedContent/{target_type}/{target_id}/Resolve", json=body)

    # ------------------------------------------------------------------ suspensions & users

    def suspensions(self, status=None, user_id=None, page=1, page_size=100):
        return self._json("GET", "/api/Admin/Suspensions",
                          params=_params(status=status, userId=user_id, page=page, pageSize=page_size))

    def suspend(self, user_id, duration_hours, reason):
        return self._json("POST", "/api/Admin/Suspensions",
                          json={"userId": user_id, "durationHours": duration_hours, "reason": reason})

    def revoke(self, suspension_id, reason):
        return self._json("POST", f"/api/Admin/Suspensions/{suspension_id}/Revoke", json={"reason": reason})

    def search_users(self, query, page=1, page_size=50):
        return self._json("GET", "/api/Admin/Users", params=_params(query=query, page=page, pageSize=page_size))

    def user_suspensions(self, user_id):
        return self._json("GET", f"/api/Admin/Users/{user_id}/Suspensions")

    # ------------------------------------------------------------------ evidence pictures

    def image(self, kind, file_name):
        """kind: "listing" or "item" (thumbnail.kind from the API)."""
        return self._request("GET", f"/api/Admin/Images/{kind}/{file_name}").content
