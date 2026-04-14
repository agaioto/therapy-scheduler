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

// --- Busca por período ---

const rangeForm = document.querySelector('#range-form');
const rangeFromInput = document.querySelector('#range-from');
const rangeToInput = document.querySelector('#range-to');
const rangeMessage = document.querySelector('#range-message');
const rangeResult = document.querySelector('#range-result');

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR');
}

function renderTable(reservations) {
  if (reservations.length === 0) {
    rangeResult.innerHTML = '<p>Nenhum agendamento encontrado no período.</p>';
    return;
  }

  const rows = reservations.map((r) => `
    <tr>
      <td>${formatDate(r.startAt)}</td>
      <td>${formatTime(r.startAt)}</td>
      <td>${r.durationMinutes} min</td>
      <td>${r.roomName}</td>
      <td>${r.therapy}</td>
      <td>${r.patientName}</td>
    </tr>
  `).join('');

  rangeResult.innerHTML = `
    <table class="range-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Horário</th>
          <th>Duração</th>
          <th>Sala</th>
          <th>Terapia</th>
          <th>Paciente</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function loadRangeReservations(event) {
  event.preventDefault();
  const from = rangeFromInput.value;
  const to = rangeToInput.value;

  rangeMessage.textContent = '';
  rangeResult.innerHTML = '';

  if (!from || !to) {
    rangeMessage.textContent = 'Preencha as duas datas.';
    rangeMessage.style.color = '#b91c1c';
    return;
  }

  if (to < from) {
    rangeMessage.textContent = 'A data final não pode ser anterior à data inicial.';
    rangeMessage.style.color = '#b91c1c';
    return;
  }

  rangeResult.innerHTML = '<p>Carregando...</p>';

  try {
    const res = await fetch(
      `/api/reception/reservations/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao buscar agendamentos.');
    }
    const data = await res.json();
    renderTable(data.reservations);
  } catch (err) {
    rangeResult.innerHTML = '';
    rangeMessage.textContent = err.message || 'Erro de conexão.';
    rangeMessage.style.color = '#b91c1c';
  }
}

rangeForm.addEventListener('submit', loadRangeReservations);
