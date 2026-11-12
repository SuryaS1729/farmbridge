# Farmbridge administrator web application

The planned administrator web application uses TanStack Start, React, and TypeScript. It serves administrator workflows, including daily pricing, offer review and management, deals, pickups, inspections, payment recording, and education category/video management.

The administrator offer dashboard should display each submitted offer's price, quantity in quintals, readiness date/time, expected price per kg, farmer-reported moisture percentage, and farmer-reported bean count per 100 g. Submitting an offer is the farmer's explicit intent to sell, so there is no separate sell-now response. The reported quality values are not verified inspection results. Actual quality inspection and accepted quantities remain in the deal workflow.

The education area is content within the farmer app. Administrators manage its categories and video entries here, including publication status and display ordering. Whether videos will be external links or uploaded files is unresolved; do not select or implement storage until that is confirmed.

The API is authoritative for authentication and authorization. Enforce administrator permissions server-side, including restricted access to bank details and any identity fields approved for collection.
