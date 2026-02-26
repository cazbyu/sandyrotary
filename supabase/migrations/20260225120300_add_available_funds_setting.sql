/*
  # Add Available Funds club setting

  Adds a default 'available_funds' key to club_settings for the Scorecard widget.
  Also adds 'ghl_referral_form_url' for the Connect & Grow card's Refer a Friend button.
*/

INSERT INTO p0012_rotary.club_settings (key, value)
VALUES ('available_funds', '0')
ON CONFLICT (key) DO NOTHING;

INSERT INTO p0012_rotary.club_settings (key, value)
VALUES ('ghl_referral_form_url', '')
ON CONFLICT (key) DO NOTHING;
