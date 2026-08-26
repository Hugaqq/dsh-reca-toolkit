from __future__ import annotations

import unittest
from unittest.mock import patch

from videorlm.backends.media.impl.dashscope.video import wan30
from videorlm.backends.media.interface.requests import SegmentRequest


class Wan30I2VMediaTests(unittest.TestCase):
    def test_i2v_submits_one_hard_first_frame_and_no_reference_images(self) -> None:
        calls: list[dict] = []

        def fake_generate(**kwargs):
            calls.append(kwargs)
            return "https://provider.example/result.mp4"

        request = SegmentRequest(
            request_id="wan30-i2v-hard-first-frame",
            prompt="continue forward from the supplied frame",
            first_url="https://assets.example/previous-segment-tail.png",
            mode="i2v",
            reference_image_urls=(
                "https://assets.example/portrait.png",
                "https://assets.example/scene.png",
            ),
            output_path="/tmp/wan30-i2v-hard-first-frame.mp4",
        )

        with patch.object(wan30, "_generate", side_effect=fake_generate):
            wan30.Wan30VideoBackend().render_segment(request)

        self.assertEqual(len(calls), 1)
        self.assertEqual(
            calls[0]["media"],
            [{"type": "first_frame", "url": request.first_url}],
        )
        self.assertEqual(calls[0]["prompt"], request.prompt)


if __name__ == "__main__":
    unittest.main()
