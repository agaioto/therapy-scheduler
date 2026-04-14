const form = document.querySelector('form');
const messageElement = document.querySelector('#message');

async function handleAuthForm() {
  if (!form) return;
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!messageElement) return;

    const isRegister = window.location.pathname === '/register';
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (isRegister) {
      if (!data.name || !data.phone || !data.address || !data.username || !data.password) {
        messageElement.textContent = 'Preencha todos os campos obrigatórios.';
        messageElement.style.color = '#b91c1c';
        return;
      }
      if (data.password.length < 6) {
        messageElement.textContent = 'A senha deve ter pelo menos 6 caracteres.';
        messageElement.style.color = '#b91c1c';
        return;
      }
    } else {
      if (!data.username || !data.password) {
        messageElement.textContent = 'Preencha usuário e senha.';
        messageElement.style.color = '#b91c1c';
        return;
      }
    }

    messageElement.textContent = 'Enviando...';
    messageElement.style.color = '';
    if (submitButton) submitButton.disabled = true;

    const url = isRegister ? '/register' : '/login';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) {
        messageElement.textContent = result.error || 'Erro inesperado.';
        messageElement.style.color = '#b91c1c';
        return;
      }

      if (isRegister) {
        messageElement.style.color = '#059669';
        messageElement.textContent = 'Cadastro concluído. Agora faça login.';
        form.reset();
        return;
      }

      localStorage.setItem('patient', JSON.stringify(result));
      window.location.href = '/rooms';
    } catch (err) {
      messageElement.textContent = 'Erro de conexão. Tente novamente.';
      messageElement.style.color = '#b91c1c';
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function formatTime(timeString) {
  return timeString;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Falha ao carregar dados.');
  }

  return response.json();
}

async function loadRoomsPage() {
  const patient = JSON.parse(localStorage.getItem('patient') || 'null');
  if (!patient) {
    window.location.href = '/login';
    return;
  }

  const welcome = document.querySelector('#welcome');
  const roomList = document.querySelector('#room-list');
  const availability = document.querySelector('#availability');
  const selectedRoomName = document.querySelector('#selected-room-name');
  const dateInput = document.querySelector('#date');
  const durationSelect = document.querySelector('#duration');
  const slotsContainer = document.querySelector('#slots');
  const logoutButton = document.querySelector('#logout');
  const message = document.querySelector('#message');

  if (welcome) {
    welcome.textContent = `Olá, ${patient.name}! Escolha uma sala para ver horários válidos.`;
  }

  if (dateInput) {
    const today = new Date().toISOString().slice(0, 10);
    dateInput.value = today;
    dateInput.min = today;
  }

  if (durationSelect) {
    durationSelect.innerHTML = [60, 120]
      .map((minutes) => `<option value="${minutes}">${minutes} minutos</option>`)
      .join('');
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('patient');
      window.location.href = '/login';
    });
  }

  let selectedRoomId = null;
  let selectedRoomTitle = '';

  async function renderAvailability() {
    if (!selectedRoomId || !dateInput || !durationSelect || !slotsContainer || !availability) return;

    const date = dateInput.value;
    const duration = durationSelect.value;

    if (!date || !duration) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      slotsContainer.innerHTML = '';
      availability.hidden = false;
      if (selectedRoomName) selectedRoomName.textContent = selectedRoomTitle;
      slotsContainer.innerHTML = '<p>Selecione uma data a partir de hoje.</p>';
      return;
    }

    try {
      const data = await fetchJson(`/api/availability?roomId=${encodeURIComponent(selectedRoomId)}&date=${encodeURIComponent(date)}&durationMinutes=${encodeURIComponent(duration)}`);
      slotsContainer.innerHTML = '';
      availability.hidden = false;

      if (selectedRoomName) {
        selectedRoomName.textContent = selectedRoomTitle;
      }

      if (data.slots.length === 0) {
        slotsContainer.innerHTML = '<p>Nenhum horário disponível para esta sala nesta data.</p>';
        return;
      }

      slotsContainer.innerHTML = `
        <ul class="slots-list">
          ${data.slots.map((slot) => `<li><button type="button" class="slot-button" data-time="${slot}">${formatTime(slot)}</button></li>`).join('')}
        </ul>
      `;

      slotsContainer.querySelectorAll('.slot-button').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const time = btn.getAttribute('data-time');
          const dateStr = dateInput.value;
          const startAt = new Date(`${dateStr}T${time}:00`).toISOString();
          const duration = Number(durationSelect.value);

          if (message) {
            message.textContent = 'Reservando...';
            message.style.color = '';
          }

          try {
            const res = await fetch('/api/reservations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                patientId: patient.id,
                roomId: selectedRoomId,
                startAt,
                durationMinutes: duration,
              }),
            });

            const result = await res.json();
            if (!res.ok) {
              if (message) {
                message.textContent = result.error || 'Erro ao reservar.';
                message.style.color = '#b91c1c';
              }
              return;
            }

            if (message) {
              message.textContent = `Reserva confirmada! ${result.roomName} (${result.therapy}) em ${dateStr} às ${time} por ${duration} min. Para dúvidas ou alterações, entre em contato via WhatsApp.`;
              message.style.color = '#059669';
            }

            await renderAvailability();
            await loadMyReservations();
          } catch (err) {
            if (message) {
              message.textContent = 'Erro de conexão ao reservar.';
              message.style.color = '#b91c1c';
            }
          }
        });
      });
    } catch (error) {
      if (message) {
        message.textContent = 'Erro ao carregar horários disponíveis.';
        message.style.color = '#b91c1c';
      }
    }
  }

  function renderRooms(rooms) {
    if (!roomList) return;
    roomList.innerHTML = rooms
      .map(
        (room) => `
          <button type="button" class="room-card button" data-room-id="${room.id}" data-room-name="${room.name}">
            <strong>${room.name}</strong>
            <span>${room.therapy}</span>
          </button>
        `
      )
      .join('');

    roomList.querySelectorAll('button[data-room-id]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        const target = event.currentTarget;
        selectedRoomId = target.getAttribute('data-room-id');
        selectedRoomTitle = target.getAttribute('data-room-name') || '';
        await renderAvailability();
      });
    });
  }

  const reservationsList = document.querySelector('#reservations-list');

  async function loadMyReservations() {
    if (!reservationsList) return;
    try {
      const data = await fetchJson(`/api/reservations?patientId=${encodeURIComponent(patient.id)}`);
      if (data.reservations.length === 0) {
        reservationsList.innerHTML = '<p>Você não tem reservas ativas.</p>';
        return;
      }

      reservationsList.innerHTML = data.reservations.map((r) => {
        const dateObj = new Date(r.startAt);
        const dateStr = dateObj.toLocaleDateString('pt-BR');
        const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const hoursUntil = (dateObj.getTime() - Date.now()) / (1000 * 60 * 60);
        const canCancel = hoursUntil >= 24;
        const cancelHtml = canCancel
          ? `<button type="button" class="cancel-button" data-reservation-id="${r.id}">Cancelar</button>`
          : `<span class="no-cancel">Cancelamento indisponível (menos de 24h)</span>`;
        return `
          <div class="reservation-card" data-reservation-id="${r.id}">
            <strong>${r.roomName}</strong> — ${r.therapy}
            <span>${dateStr} às ${timeStr} (${r.durationMinutes} min)</span>
            ${cancelHtml}
          </div>
        `;
      }).join('');

      reservationsList.querySelectorAll('.cancel-button').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const reservationId = btn.getAttribute('data-reservation-id');
          if (!confirm('Tem certeza que deseja cancelar esta reserva?')) return;

          try {
            const res = await fetch(`/api/reservations/${reservationId}/cancel`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ patientId: patient.id }),
            });

            const result = await res.json();
            if (!res.ok) {
              if (message) {
                message.textContent = result.error || 'Erro ao cancelar.';
                message.style.color = '#b91c1c';
              }
              return;
            }

            if (message) {
              message.textContent = 'Reserva cancelada com sucesso.';
              message.style.color = '#059669';
            }

            await loadMyReservations();
            await renderAvailability();
          } catch (err) {
            if (message) {
              message.textContent = 'Erro de conexão ao cancelar.';
              message.style.color = '#b91c1c';
            }
          }
        });
      });
    } catch (error) {
      reservationsList.innerHTML = '<p>Erro ao carregar reservas.</p>';
    }
  }

  if (dateInput) dateInput.addEventListener('change', renderAvailability);
  if (durationSelect) durationSelect.addEventListener('change', renderAvailability);

  try {
    const result = await fetchJson('/api/rooms');
    renderRooms(result.rooms);
    await loadMyReservations();
  } catch (error) {
    if (message) {
      message.textContent = 'Não foi possível carregar as salas.';
      message.style.color = '#b91c1c';
    }
  }
}

if (window.location.pathname === '/rooms') {
  loadRoomsPage();
} else if (window.location.pathname === '/login' && localStorage.getItem('patient')) {
  window.location.href = '/rooms';
} else {
  handleAuthForm();
}
