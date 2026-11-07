"""What a play request may name."""

import pydantic
import pytest

from backend.main import SourceBody


def test_an_empty_source_is_refused_before_it_reaches_a_player():
    # A player told to play "" drops what it had: a soundbar left its TV input.
    with pytest.raises(pydantic.ValidationError):
        SourceBody(uri="")
