const Consul = require("consul");
const consulClient = new Consul({
  host: process.env.CONSUL_HOST || "localhost",
  port: process.env.CONSUL_PORT || 8500,
  promisify: true,
});
const registerWithConsul = async (
  serviceName,
  serviceId,
  port,
  serviceHost
) => {
  const service = {
    name: serviceName,
    id: serviceId,
    address: serviceHost,
    port: parseInt(port),
    check: {
      tcp: `${serviceHost}:${port}`,
      interval: "10s",
      timeout: "5s",
      deregistercriticalserviceafter: "1m",
    },
  };
  try {
    await consulClient.agent.service.register(service);
    console.log(
      `Successfully registered service: ${serviceId} with address ${serviceHost}`
    );
  } catch (error) {
    console.error(`Failed to register service ${serviceId}:`, error.message);
    throw error;
  }
};
const deregisterFromConsul = async (serviceId) => {
  try {
    await consulClient.agent.service.deregister(serviceId);
    console.log(`Deregistered from Consul: ${serviceId}`);
  } catch (error) {
    console.error(`Failed to deregister ${serviceId}:`, error.message);
  }
};
module.exports = { registerWithConsul, deregisterFromConsul };
