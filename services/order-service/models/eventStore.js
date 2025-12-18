// In-Memory Event Store
// Структура: Map<orderId, Array<Event>>
const eventStore = new Map();

class EventStore {
  save(orderId, eventType, payload) {
    if (!eventStore.has(orderId)) {
      eventStore.set(orderId, []);
    }
    const event = { type: eventType, payload, timestamp: new Date() };
    eventStore.get(orderId).push(event);
    return event;
  }

  getEvents(orderId) {
    return eventStore.get(orderId) || [];
  }

  // Rehydration: Восстановление состояния из истории событий
  getOrderState(orderId) {
    const events = this.getEvents(orderId);
    if (events.length === 0) return null;

    // Начальное состояние
    let state = { id: orderId, status: "unknown", items: [], totalAmount: 0 };

    // Проигрываем события (Reduce)
    events.forEach((event) => {
      switch (event.type) {
        case "OrderCreated":
          state = { ...state, ...event.payload, status: "pending" };
          break;
        case "OrderCancelled":
          state.status = "cancelled";
          break;
        case "OrderPaid": // Если бы у нас было такое событие от payment service
          state.status = "paid";
          break;
        // Можно добавить OrderShipped и т.д.
      }
    });

    return state;
  }

  // Для совместимости: получить список всех заказов определенного юзера
  // В реальном CQRS это делается через отдельную Read Model (как в Analytics),
  // но здесь мы сделаем неэффективный перебор для простоты.
  getAllOrdersForUser(userId) {
    const orders = [];
    for (const orderId of eventStore.keys()) {
      const orderState = this.getOrderState(orderId);
      if (orderState && orderState.userId === userId) {
        orders.push(orderState);
      }
    }
    return orders;
  }
}

module.exports = new EventStore();
