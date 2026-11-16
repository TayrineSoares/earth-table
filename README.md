# Earth Table 

## Project Structure

- `frontend/` - React frontend
- `backend/` - Express backend

## Running the Project

This project requires **two servers running simultaneously**:

1. The backend server (Node/Express)
2. The frontend development server (React)

### Start the Backend

Navigate to the `backend` directory, install dependencies, and start the server:
- cd backend
- npm install
- npm start

The backend will run on `http://localhost:8080`

### Start the Frontend

In a **separate terminal**, navigate to the `frontend` directory, install dependencies, and start the React development server:

- cd frontend
- npm install
- npm run dev

The frontend will run on `http://localhost:5173`

## Docs

Internal feature wikis live under [`docs/`](docs/README.md):

- [Subscriptions](docs/subscriptions.md) — weekly Subscribe & Save
- [À la carte](docs/alacarte.md) — one-off cart → Stripe → orders
- [Partners](docs/partners.md) — referrals, wallet, invoices
- [Promos](docs/promos.md) — percent-off codes
- [Catalog](docs/catalog.md) — products, categories, tags
- [Fulfillment](docs/fulfillment.md) — pickup/delivery quotes
- [Auth](docs/auth.md) — signup, profile, admin flag
- [Site & admin](docs/site-and-admin.md) — marketing, contact, unsubscribe, Admin shell

## Notes

- Keep both servers running while developing
- CORS is enabled on the backend to allow communication between ports
- The fake data and test components can be removed later