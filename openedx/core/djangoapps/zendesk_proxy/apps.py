"""
Zendesk Proxy Configuration

"""

from django.apps import AppConfig

from openedx.core.djangoapps.plugins.constants import ProjectType, SettingsType, PluginURLs, PluginSettings


class ZendeskProxyConfig(AppConfig):
    """
    AppConfig for zendesk proxy app
    """
    name = 'openedx.core.djangoapps.zendesk_proxy'

    plugin_app = {
        PluginURLs.CONFIG: {
            ProjectType.CMS: {
                PluginURLs.NAMESPACE: u'',
                PluginURLs.REGEX: r'^zendesk_proxy/',
            },
            ProjectType.LMS: {
                PluginURLs.NAMESPACE: u'',
                PluginURLs.REGEX: r'^zendesk_proxy/',
            }
        },
        PluginSettings.CONFIG: {
            ProjectType.CMS: {
                SettingsType.COMMON: {PluginSettings.RELATIVE_PATH: u'settings.common'},
                SettingsType.AWS: {PluginSettings.RELATIVE_PATH: u'settings.aws'},
            },
            ProjectType.LMS: {
                SettingsType.COMMON: {PluginSettings.RELATIVE_PATH: u'settings.common'},
                SettingsType.AWS: {PluginSettings.RELATIVE_PATH: u'settings.aws'},
            }
        }
    }
