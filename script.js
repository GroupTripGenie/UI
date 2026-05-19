// Fetch trips from backend
async function loadTrips() {
  try {
    const res = await fetch("http://localhost:3000/api/trips");
    const data = await res.json();

    console.log("Trips from backend:", data);

    displayTrips(data);

  } catch (err) {
    console.error("Error loading trips:", err);
  }
}

function displayTrips(trips) {

  const container = document.getElementById("upcomingTrips");

  container.innerHTML = "";

  trips.forEach((trip) => {

    const tripCard = document.createElement("div");

    tripCard.classList.add("trip-card");

    tripCard.innerHTML = `
      <div class="trip-body">
        <h3>${trip.title}</h3>
        <p class="trip-dates">${trip.location || "No location"}</p>

        <div class="trip-budget">
          <span>Budget</span>
          <span>$${trip.budget || 0}</span>
        </div>

        <button class="btn-primary full-width">
          View Details
        </button>
      </div>
    `;

    container.appendChild(tripCard);

  });
}

loadTrips();