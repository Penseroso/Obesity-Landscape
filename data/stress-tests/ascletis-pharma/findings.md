# Ascletis Stress-Test Findings

Ascletis was investigated as an initial company-wide pilot because no existing
company or program records were present. This folder is a diagnostic reference
and pilot output from that run, not production data or reviewed expected output.

Key modeling findings:

- ASC30 uses one stable `assetId` across oral tablets and subcutaneous depot
  injection programs.
- ASC30 subcutaneous evidence includes a Phase 1b scientific presentation, so
  the precise canonical stage is retained as `Phase 1b`.
- ASC35 and ASC36_35 FDC regulatory milestones are captured in
  `regulatoryStates` instead of being approximated as clinical development
  stages.
- ASC36_35 FDC was modeled as a distinct combination asset, separate from ASC35,
  under the contract available during the pilot.

Future contract migrations may use this archive as stress-test evidence. It
should become golden expected output only after a fresh Ascletis investigation
and explicit review under the then-current contract.
