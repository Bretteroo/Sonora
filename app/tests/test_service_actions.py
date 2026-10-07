"""Only an action the service itself declared may be carried out.

The route attaches the household's own service token as a bearer. Before the
pre-launch audit it fetched whatever https URL the caller named,
which would have handed that token to any server somebody pointed it at.
"""

from backend.main import _declared_action, _note_service_actions, _SERVICE_ACTIONS


def setup_function():
    _SERVICE_ACTIONS.clear()


def test_an_action_the_service_declared_is_remembered_with_its_own_request():
    _note_service_actions("H", 9, [{"url": "https://svc.example/fav", "method": "put",
                                    "headers": {"X-Thing": "1"}}])
    action = _declared_action("H", 9, "https://svc.example/fav")
    assert action == {"method": "PUT", "headers": {"X-Thing": "1"}}


def test_anything_else_is_unknown():
    _note_service_actions("H", 9, [{"url": "https://svc.example/fav"}])
    assert _declared_action("H", 9, "https://attacker.example/") is None
    # Nor may one household's service speak for another's.
    assert _declared_action("OTHER", 9, "https://svc.example/fav") is None
    assert _declared_action("H", 10, "https://svc.example/fav") is None


def test_a_declaration_that_is_not_https_is_not_remembered():
    _note_service_actions("H", 9, [{"url": "http://svc.example/fav"},
                                   {"url": "file:///etc/passwd"}, {"url": ""}])
    assert _SERVICE_ACTIONS.get(("H", 9), {}) == {}


def test_what_a_service_may_make_sonora_remember_is_bounded():
    _note_service_actions("H", 9, [{"url": f"https://svc.example/{n}"} for n in range(500)])
    assert len(_SERVICE_ACTIONS[("H", 9)]) == 200
    # The newest declarations are the ones kept.
    assert _declared_action("H", 9, "https://svc.example/499") is not None
    assert _declared_action("H", 9, "https://svc.example/0") is None
