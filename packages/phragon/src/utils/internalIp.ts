import { networkInterfaces } from "os";
import defaultGateway from "default-gateway";
import ip from "ipaddr.js";

function findIp(gateway: string) {
	const gatewayIp = ip.parse(gateway);

	// Look for the matching interface in all local interfaces.
	for (const addresses of Object.values(networkInterfaces())) {
		if (!addresses) {
			continue;
		}
		for (const { cidr } of addresses) {
			if (!cidr) {
				continue;
			}

			const net = ip.parseCIDR(cidr);

			// eslint-disable-next-line unicorn/prefer-regexp-test
			if (net[0] && net[0].kind() === gatewayIp.kind() && gatewayIp.match(net)) {
				return net[0].toString();
			}
		}
	}
}

export default function internalIp(family: "v4" | "v6") {
	try {
		const { gateway } = defaultGateway[family].sync();
		return findIp(gateway);
	} catch {}
}
