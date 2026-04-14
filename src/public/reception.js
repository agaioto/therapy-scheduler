const dateInput = document.querySelector('#date');
const grid = document.querySelector('#reception-grid');
const message = document.querySelector('#message');

async function loadReservations() {
  const date = dateInput.value;
  if (!date) return;

  grid.innerHTML = '<p>Carregando...</p>';

  try {
    const res = await fetch(`/api/reception/reservations?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao carregar reservas.');
    }

    const data = await res.json();
    renderGrid(data.rooms);

    if (message) {
      message.textContent = '';
    }
  } catch (err) {
    grid.innerHTML = '';
    if (message) {
      message.textContent = err.message || 'Erro de conexão.';
      message.style.color = '#b91c1c';
    }
  }
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function renderGrid(rooms) {
  if (!rooms || rooms.length === 0) {
    grid.innerHTML = '<p>Nenhuma sala cadastrada.</p>';
    return;
  }

  grid.innerHTML = rooms.map((room) => {
    const title = `<h3>${room.roomName} <span class="room-therapy">${room.therapy}</span></h3>`;

    if (room.reservations.length === 0) {
      return `
        <div class="room-section">
          ${title}
          <p class="room-empty">Nenhuma reserva para este dia.</p>
        </div>
      `;
    }

    const items = room.reservations.map((r) => `
      <div class="reception-reservation">
        <span class="reception-time">${formatTime(r.startAt)}</span>
        <span class="reception-duration">${r.durationMinutes} min</span>
        <span class="reception-patient">${r.patientName}</span>
      </div>
    `).join('');

    return `
      <div class="room-section">
        ${title}
        ${items}
      </div>
    `;
  }).join('');
}

dateInput.value = new Date().toISOString().slice(0, 10);
dateInput.addEventListener('change', loadReservations);
loadReservations();
