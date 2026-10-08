import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("v2ray_feed_fix", Path(__file__).parents[1] / "v2ray-feed-fix.py")
proxy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proxy)


def configuration():
    return {
        "inbounds": [{"tag": "business", "port": 20172}],
        "outbounds": [
            {"tag": "node-a", "protocol": "vmess",
             "settings": {"vnext": [{"address": "node.example", "port": 443}]}},
            {"tag": "direct", "protocol": "freedom", "settings": {}},
        ],
        "routing": {"rules": [{"type": "field", "domain": ["domain:internal.example"],
                               "outboundTag": "direct"}]},
        "dns": {"servers": [{"address": "223.6.6.6", "domains": ["node.example", "mail.example"]},
                            {"address": "119.29.29.29"}]},
        "multiObservatory": {"observers": [{"tag": "business", "settings": {
            "subjectSelector": ["node-a"], "probeURL": "https://example.com/health"}}]},
    }


class ProxyConfigurationTests(unittest.TestCase):
    def test_periodic_reconciliation_does_not_reload_unchanged_configuration(self):
        config = configuration()
        self.assertTrue(proxy.ensure_deploy_network(config))
        reconciled = copy.deepcopy(config)
        self.assertFalse(proxy.ensure_deploy_network(config))
        self.assertEqual(config, reconciled)

    def test_node_dns_repair_preserves_unrelated_business_policy(self):
        config = configuration()
        original = copy.deepcopy(config)
        proxy.ensure_deploy_network(config)
        self.assertEqual(config["inbounds"], original["inbounds"])
        self.assertIn(original["routing"]["rules"][0], config["routing"]["rules"])
        self.assertIn(original["multiObservatory"]["observers"][0], config["multiObservatory"]["observers"])
        self.assertIn({"address": "223.6.6.6", "domains": ["mail.example"]}, config["dns"]["servers"])
        self.assertIn({"address": "119.29.29.29"}, config["dns"]["servers"])
        node_resolvers = [server for server in config["dns"]["servers"]
                          if "full:node.example" in server.get("domains", [])]
        self.assertEqual({server["address"] for server in node_resolvers},
                         {"tcp://1.1.1.1:53", "tcp://9.9.9.9:53"})
        self.assertTrue(config["dns"]["disableFallbackIfMatch"])

    def test_missing_nodes_fail_without_mutating_configuration(self):
        config = configuration()
        config["outbounds"] = [config["outbounds"][1]]
        original = copy.deepcopy(config)
        with self.assertRaises(ValueError):
            proxy.ensure_deploy_network(config)
        self.assertEqual(config, original)


if __name__ == "__main__":
    unittest.main()
