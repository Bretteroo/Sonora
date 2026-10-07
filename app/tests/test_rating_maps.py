"""Both spellings of the Now Playing rating map are read the same way.

AccuRadio and Amazon Music publish ``NowPlayingRatings``; Pandora publishes
``NowPlayingRatings_v2``, whose bodies are the same shape with two extra
attributes per button: the rating word the players themselves use, and
whether the item already carries it. Reading only the first spelling left
Pandora with no buttons of its own and its thumbs written out by hand in the
backend.
"""

from backend.sonos.presentation import _parse_ratings

V1 = '''<Presentation>
<PresentationMap type="NowPlayingRatings">
  <Match propname="vote" value="0">
    <Ratings>
      <Rating AutoSkip="NEVER" Id="1" StringId="VoteUp" OnSuccessStringId="VoteUpSuccess">
        <Icon Controller="pcdcr" Uri="https://example.invalid/STAR_UNSELECTED.png"/>
      </Rating>
      <Rating AutoSkip="ALWAYS" Id="0" StringId="VoteDown" OnSuccessStringId="VoteDownSuccess">
        <Icon Controller="pcdcr" Uri="https://example.invalid/PROHIBITED_UNSELECTED.png"/>
      </Rating>
    </Ratings>
  </Match>
</PresentationMap>
</Presentation>'''

V2 = '''<Presentation>
<PresentationMap type="NowPlayingRatings_v2">
  <Match propname="rating" value="0" type="NONE">
    <Ratings>
      <Rating AutoSkip="ALWAYS" Id="2" StringId="THUMBS_DOWN" OnSuccessStringId="D" Type="THUMBSDOWN" State="UNRATED">
        <Icon Controller="pcdcr" Uri="https://example.invalid/THUMBSDOWN_UNSELECTED.png"/>
      </Rating>
      <Rating AutoSkip="NEVER" Id="1" StringId="THUMBS_UP" OnSuccessStringId="U" Type="THUMBSUP" State="UNRATED">
        <Icon Controller="pcdcr" Uri="https://example.invalid/THUMBSUP_UNSELECTED.png"/>
      </Rating>
    </Ratings>
  </Match>
  <Match propname="rating" value="1" type="THUMBSUP">
    <Ratings>
      <Rating AutoSkip="NEVER" Id="3" StringId="REMOVE_THUMBS_UP" OnSuccessStringId="R" Type="THUMBSUP" State="RATED">
        <Icon Controller="pcdcr" Uri="https://example.invalid/THUMBSUP_SELECTED.png"/>
      </Rating>
    </Ratings>
  </Match>
</PresentationMap>
</Presentation>'''


def test_the_older_spelling_still_reads():
    propname, matches, kinds = _parse_ratings(V1)
    assert propname == "vote"
    assert [b["id"] for b in matches["0"]] == ["1", "0"]
    assert matches["0"][1]["auto_skip"] == "ALWAYS"
    # Nothing in this spelling names a rating word, so nothing is claimed.
    assert kinds == {}
    assert matches["0"][0]["rating_type"] == ""


def test_the_newer_spelling_reads_the_same_way():
    propname, matches, _ = _parse_ratings(V2)
    assert propname == "rating"
    assert [b["id"] for b in matches["0"]] == ["2", "1"]
    assert matches["0"][0]["icon"].endswith("THUMBSDOWN_UNSELECTED.png")


def test_the_newer_spelling_names_the_rating_and_its_state():
    _, matches, kinds = _parse_ratings(V2)
    # Which set of buttons belongs to each rating the players report.
    assert kinds == {"NONE": "0", "THUMBSUP": "1"}
    # Pressing an UNRATED button sets that rating; pressing the RATED one
    # takes it away, which is how the desktop apps' toggle behaves.
    up = next(b for b in matches["0"] if b["id"] == "1")
    assert (up["rating_type"], up["rating_state"]) == ("THUMBSUP", "UNRATED")
    remove = matches["1"][0]
    assert (remove["rating_type"], remove["rating_state"]) == ("THUMBSUP", "RATED")


def test_a_service_with_no_rating_map_says_so():
    assert _parse_ratings("<Presentation></Presentation>") == ("", {}, {})
