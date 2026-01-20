import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate } from "k6/metrics";

// Метрики
export const errorRate = new Rate("errors");

// Конфигурация теста
export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Разогрев: подъем до 10 пользователей
    { duration: "1m", target: 20 }, // Нагрузка: 20 пользователей
    { duration: "30s", target: 0 }, // Остывание
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% запросов должны быть быстрее 500мс
    errors: ["rate<0.01"], // Ошибок должно быть меньше 1%
  },
};

// tests/load_test.js
const BASE_URL = "http://nginx-gateway:8080/api"; // <-- ИСПОЛЬЗОВАТЬ ЭТО (внутри сети докера)
// Если запускаете k6 локально (не в докере), используйте 'http://localhost:8080/api'

export function setup() {
  // 1. Регистрация (игнорируем ошибку, если юзер уже есть)
  const userPayload = JSON.stringify({
    username: `loadtest_${__VU}`,
    email: `loadtest_${__VU}@example.com`,
    password: "password123",
  });
  const params = { headers: { "Content-Type": "application/json" } };

  http.post(`${BASE_URL}/auth/register`, userPayload, params);

  // 2. Логин (получение токена)
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: `loadtest_${__VU}@example.com`,
      password: "password123",
    }),
    params
  );

  const token = loginRes.json("token");
  return { token };
}

export default function (data) {
  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.token}`,
    },
  };

  group("User Flow", function () {
    // 1. Просмотр каталога
    const catalogRes = http.get(`${BASE_URL}/products?limit=5`);
    check(catalogRes, {
      "Catalog status is 200": (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(1);

    // 2. Создание заказа
    const orderPayload = JSON.stringify({
      items: [
        { productId: 1, quantity: 1, price: 29.99 },
        { productId: 2, quantity: 2, price: 49.99 },
      ],
    });

    const orderRes = http.post(`${BASE_URL}/orders`, orderPayload, params);
    check(orderRes, {
      "Order created (201/202)": (r) => r.status === 201 || r.status === 202,
    }) || errorRate.add(1);

    sleep(2);
  });
}
