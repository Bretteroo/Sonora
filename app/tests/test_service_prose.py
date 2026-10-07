"""Text a service writes as HTML, shown as the apps show it.

SMAPI hands text over as XML, so ``&amp;`` is already an ampersand by the
time it is parsed -- but providers write their descriptions as HTML and
escape them a second time. Libby's audiobook summaries arrive reading
``NEW YORK TIMES BESTSELLER &bull;``, with ``&rsquo;`` and ``&mdash;``
through the rest of the paragraph, and the product draws the punctuation.

Only text meant to be read is resolved. An id or a URI is left exactly as it
came: the HTML5 unescaping rules resolve a few entities without their
semicolon, so a query string's ``&copy=`` would turn into a copyright sign.
"""

from __future__ import annotations

from backend.sonos.smapi import SmapiClient, prose


def test_a_summary_is_read_as_html():
    assert prose("BESTSELLER &bull; a history&mdash;of the soul") == (
        "BESTSELLER • a history—of the soul")


def test_ordinary_text_is_untouched():
    assert prose("Radio NGM") == "Radio NGM"
    assert prose("Simon & Garfunkel") == "Simon & Garfunkel"


def test_the_item_resolves_the_fields_a_reader_sees():
    xml = """<?xml version="1.0"?>
    <getMetadataResponse xmlns="http://www.sonos.com/Services/1.1">
      <getMetadataResult>
        <index>0</index><count>1</count><total>1</total>
        <mediaCollection>
          <id>book-1</id>
          <itemType>audiobook</itemType>
          <title>Alexievich&amp;rsquo;s Secondhand Time</title>
          <summary>BESTSELLER &amp;bull; a symphonic oral history</summary>
          <albumArtURI>https://img3.od-cdn.com/x.jpg?width=200&amp;copy=1</albumArtURI>
        </mediaCollection>
      </getMetadataResult>
    </getMetadataResponse>"""
    item = SmapiClient._parse(xml).items[0]
    assert item.title == "Alexievich’s Secondhand Time"
    assert item.summary == "BESTSELLER • a symphonic oral history"
    # The picture's address keeps every character it arrived with.
    assert item.art == "https://img3.od-cdn.com/x.jpg?width=200&copy=1"
