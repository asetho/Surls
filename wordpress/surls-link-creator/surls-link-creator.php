<?php
/**
 * Plugin Name: Surls Link Creator
 * Description: Create Surls short links from inside WordPress.
 * Version: 0.2.0
 * Author: Surls
 * License: MIT
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Surls_Link_Creator {
    private const OPTION_NAME = 'surls_link_creator_options';
    private const NOTICE_TRANSIENT_PREFIX = 'surls_link_creator_notice_';
    private const META_SHORT_URL = '_surls_short_url';
    private const META_CODE = '_surls_code';
    private const META_LINK_ID = '_surls_link_id';
    private const META_SYNCED_AT = '_surls_synced_at';

    public function __construct() {
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_menu', array($this, 'add_settings_page'));
        add_action('admin_notices', array($this, 'render_admin_notice'));
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('admin_post_surls_create_custom_link', array($this, 'handle_custom_link'));
        add_action('admin_post_surls_create_post_link', array($this, 'handle_post_link'));
        add_action('admin_post_surls_test_connection', array($this, 'handle_test_connection'));
        add_filter('pre_get_shortlink', array($this, 'filter_wordpress_shortlink'), 10, 4);
    }

    public static function activate(): void {
        if (get_option(self::OPTION_NAME, null) === null) {
            add_option(
                self::OPTION_NAME,
                array(
                    'base_url' => '',
                    'api_token' => '',
                    'default_code_from_slug' => '1',
                    'include_wordpress_tags' => '1',
                ),
                '',
                false
            );
        }
    }

    public function register_settings(): void {
        register_setting(
            'surls_link_creator',
            self::OPTION_NAME,
            array(
                'sanitize_callback' => array($this, 'sanitize_options'),
                'type' => 'array',
            )
        );
    }

    public function sanitize_options($input): array {
        $current = $this->options();
        $input = is_array($input) ? $input : array();

        $base_url = isset($input['base_url']) ? esc_url_raw(trim((string) $input['base_url'])) : '';
        if ($base_url !== '') {
            if (!$this->is_valid_api_base_url($base_url)) {
                add_settings_error(self::OPTION_NAME, 'invalid_base_url', 'Enter a valid HTTPS Surls base URL.');
                $current_base_url = (string) ($current['base_url'] ?? '');
                $base_url = $this->is_valid_api_base_url($current_base_url) ? $current_base_url : '';
            } else {
                $base_url = untrailingslashit($base_url);
            }
        }

        $api_token = $current['api_token'] ?? '';
        if (!empty($input['clear_api_token'])) {
            $api_token = '';
        } elseif (isset($input['api_token']) && trim((string) $input['api_token']) !== '') {
            $api_token = sanitize_text_field((string) $input['api_token']);
        }

        return array(
            'base_url' => $base_url,
            'api_token' => $api_token,
            'default_code_from_slug' => !empty($input['default_code_from_slug']) ? '1' : '',
            'include_wordpress_tags' => !empty($input['include_wordpress_tags']) ? '1' : '',
        );
    }

    public function add_settings_page(): void {
        add_options_page(
            'Surls',
            'Surls',
            'manage_options',
            'surls-link-creator',
            array($this, 'render_settings_page')
        );
    }

    public function render_settings_page(): void {
        if (!current_user_can('manage_options')) {
            return;
        }

        $options = $this->options();
        ?>
        <div class="wrap">
            <h1>Surls</h1>
            <form method="post" action="options.php">
                <?php settings_fields('surls_link_creator'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="surls-base-url">Surls base URL</label></th>
                        <td>
                            <input id="surls-base-url" class="regular-text" type="url" name="<?php echo esc_attr(self::OPTION_NAME); ?>[base_url]" value="<?php echo esc_attr($options['base_url']); ?>" placeholder="https://links.example.com" required>
                            <p class="description">The HTTPS root URL of your Surls install.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="surls-api-token">API token</label></th>
                        <td>
                            <input id="surls-api-token" class="regular-text" type="password" name="<?php echo esc_attr(self::OPTION_NAME); ?>[api_token]" value="" autocomplete="new-password" placeholder="<?php echo $options['api_token'] ? esc_attr('Token saved; enter a new token to replace it') : esc_attr('surls_...'); ?>">
                            <?php if ($options['api_token']) : ?>
                                <label style="display:block;margin-top:.5rem;">
                                    <input type="checkbox" name="<?php echo esc_attr(self::OPTION_NAME); ?>[clear_api_token]" value="1">
                                    Clear saved API token
                                </label>
                            <?php endif; ?>
                            <p class="description">Create a link-creation token in Surls Admin -&gt; Tools. WordPress stores the plain token so it can call the API.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Editor defaults</th>
                        <td>
                            <label>
                                <input type="checkbox" name="<?php echo esc_attr(self::OPTION_NAME); ?>[default_code_from_slug]" value="1" <?php checked($options['default_code_from_slug'], '1'); ?>>
                                Prefill the optional keyword from the WordPress slug
                            </label>
                            <br>
                            <label>
                                <input type="checkbox" name="<?php echo esc_attr(self::OPTION_NAME); ?>[include_wordpress_tags]" value="1" <?php checked($options['include_wordpress_tags'], '1'); ?>>
                                Send WordPress and post type tags to Surls
                            </label>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Save Surls settings'); ?>
            </form>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('surls_test_connection'); ?>
                <input type="hidden" name="action" value="surls_test_connection">
                <?php submit_button('Test saved connection', 'secondary', 'submit', false); ?>
                <p class="description">Checks the saved HTTPS URL and API token without creating a link. Save any changes above first.</p>
            </form>

            <hr>

            <h2>Create a Surls link</h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('surls_create_custom_link'); ?>
                <input type="hidden" name="action" value="surls_create_custom_link">
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="surls-destination-url">Destination URL</label></th>
                        <td><input id="surls-destination-url" class="regular-text" type="url" name="destination_url" required></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="surls-code">Optional keyword</label></th>
                        <td><input id="surls-code" class="regular-text" type="text" name="code"></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="surls-title">Title</label></th>
                        <td><input id="surls-title" class="regular-text" type="text" name="title"></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="surls-tags">Tags</label></th>
                        <td>
                            <input id="surls-tags" class="regular-text" type="text" name="tags" placeholder="wordpress, campaign">
                            <p class="description">Comma-separated tags.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Create short link'); ?>
            </form>
        </div>
        <?php
    }

    public function add_meta_boxes(): void {
        foreach ($this->supported_post_types() as $post_type) {
            add_meta_box(
                'surls-link-creator',
                'Surls short link',
                array($this, 'render_post_meta_box'),
                $post_type,
                'side',
                'default'
            );
        }
    }

    public function render_post_meta_box(WP_Post $post): void {
        $options = $this->options();
        $short_url = (string) get_post_meta($post->ID, self::META_SHORT_URL, true);
        $stored_code = (string) get_post_meta($post->ID, self::META_CODE, true);
        $code = $stored_code;
        if ($code === '' && $options['default_code_from_slug'] === '1') {
            $code = $post->post_name;
        }

        if (!$this->is_configured()) {
            echo '<p>Configure Surls under Settings -&gt; Surls before creating links.</p>';
            return;
        }

        if ($short_url !== '') {
            echo '<p><strong>Short link</strong></p>';
            echo '<p><input type="text" class="widefat" readonly value="' . esc_attr($short_url) . '"></p>';
            echo '<p><a href="' . esc_url($short_url) . '" target="_blank" rel="noopener">Open short link</a></p>';
        }
        ?>
        <p>
            <label for="surls-post-code"><strong>Optional keyword</strong></label>
            <input id="surls-post-code" class="widefat" type="text" value="<?php echo esc_attr($code); ?>" data-surls-keyword autocomplete="off">
        </p>
        <p>
            <a class="button button-secondary" href="<?php echo esc_url($this->post_create_url($post)); ?>" data-surls-create-post-link>
                <?php echo esc_html($short_url ? 'Create another Surls link' : 'Create Surls link'); ?>
            </a>
        </p>
        <script>
        (function() {
            var input = document.getElementById('surls-post-code');
            var link = document.querySelector('[data-surls-create-post-link]');
            if (!input || !link) return;

            var baseHref = link.href;
            link.addEventListener('click', function() {
                var url = new URL(baseHref);
                url.searchParams.set('code', input.value.trim());
                link.href = url.toString();
            });
        }());
        </script>
        <?php
    }

    public function handle_custom_link(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Sorry, you are not allowed to create Surls links.', 'surls-link-creator'));
        }

        check_admin_referer('surls_create_custom_link');

        $payload = array(
            'destinationUrl' => esc_url_raw((string) wp_unslash($_POST['destination_url'] ?? '')),
        );

        $code = sanitize_text_field((string) wp_unslash($_POST['code'] ?? ''));
        $title = sanitize_text_field((string) wp_unslash($_POST['title'] ?? ''));
        $tags = $this->parse_tags((string) wp_unslash($_POST['tags'] ?? ''));

        if ($code !== '') {
            $payload['code'] = $code;
        }
        if ($title !== '') {
            $payload['title'] = $title;
        }
        if ($tags) {
            $payload['tags'] = $tags;
        }

        $this->create_link_and_redirect($payload, admin_url('options-general.php?page=surls-link-creator'));
    }

    public function handle_test_connection(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Sorry, you are not allowed to test the Surls connection.', 'surls-link-creator'));
        }

        check_admin_referer('surls_test_connection');

        $options = $this->options();
        if (!$this->is_valid_api_base_url((string) $options['base_url']) || $options['api_token'] === '') {
            $this->set_notice('Save a valid HTTPS Surls base URL and API token first.', 'error');
        } else {
            $response = wp_remote_get(
                $options['base_url'] . '/api/tokens/verify',
                array(
                    'timeout' => 15,
                    'redirection' => 0,
                    'sslverify' => true,
                    'headers' => array(
                        'Accept' => 'application/json',
                        'Authorization' => 'Bearer ' . $options['api_token'],
                    ),
                )
            );

            if (is_wp_error($response)) {
                $this->set_notice('Could not reach Surls over HTTPS. Check the URL, TLS certificate, and network access.', 'error');
            } else {
                $status = (int) wp_remote_retrieve_response_code($response);
                $body = json_decode((string) wp_remote_retrieve_body($response), true);
                if ($status === 200 && is_array($body) && ($body['ok'] ?? false) === true) {
                    $this->set_notice('Connection successful. Surls accepted the saved token for link creation.');
                } elseif ($status === 401) {
                    $this->set_notice('Surls rejected the API token. Check that it is active and permits link creation.', 'error');
                } elseif ($status === 404) {
                    $this->set_notice('This Surls site does not support connection testing. Upgrade it to Surls 3.0.0.', 'error');
                } else {
                    $this->set_notice('Connection test failed. Surls returned HTTP ' . $status . '.', 'error');
                }
            }
        }

        wp_safe_redirect(admin_url('options-general.php?page=surls-link-creator'));
        exit;
    }

    public function handle_post_link(): void {
        $post_id = absint($_GET['post_id'] ?? 0);
        if (!current_user_can('edit_post', $post_id)) {
            wp_die(esc_html__('Sorry, you are not allowed to create a Surls link for this post.', 'surls-link-creator'));
        }

        check_admin_referer('surls_create_post_link_' . $post_id);

        $post = get_post($post_id);
        if (!$post instanceof WP_Post) {
            $this->set_notice('Could not find that WordPress post.', 'error');
            wp_safe_redirect(admin_url('edit.php'));
            exit;
        }

        $destination_url = get_permalink($post);
        if (!$destination_url) {
            $this->set_notice('WordPress could not build a permalink for this post.', 'error');
            wp_safe_redirect(get_edit_post_link($post_id, 'raw') ?: admin_url('edit.php'));
            exit;
        }

        $payload = array(
            'destinationUrl' => esc_url_raw($destination_url),
            'title' => sanitize_text_field(get_the_title($post)),
        );

        $has_requested_code = array_key_exists('code', $_GET);
        $code = $has_requested_code ? sanitize_text_field((string) wp_unslash($_GET['code'])) : '';
        if ($code === '' && !$has_requested_code && $this->options()['default_code_from_slug'] === '1') {
            $code = sanitize_text_field($post->post_name);
        }
        if ($code !== '') {
            $payload['code'] = $code;
        }

        if ($this->options()['include_wordpress_tags'] === '1') {
            $payload['tags'] = array_values(array_filter(array('wordpress', $post->post_type)));
        }

        $result = $this->create_link($payload);
        if (is_wp_error($result)) {
            $this->set_notice($result->get_error_message(), 'error');
        } else {
            update_post_meta($post_id, self::META_SHORT_URL, esc_url_raw((string) $result['shortUrl']));
            update_post_meta($post_id, self::META_CODE, sanitize_text_field((string) ($result['code'] ?? $code)));
            update_post_meta($post_id, self::META_LINK_ID, sanitize_text_field((string) ($result['id'] ?? '')));
            update_post_meta($post_id, self::META_SYNCED_AT, gmdate('c'));
            $this->set_notice('Surls link created: ' . (string) $result['shortUrl']);
        }

        wp_safe_redirect(get_edit_post_link($post_id, 'raw') ?: admin_url('edit.php'));
        exit;
    }

    public function filter_wordpress_shortlink($shortlink, $id, $context, $allow_slugs) {
        if ($context !== 'post' || !$id) {
            return $shortlink;
        }

        $surls_shortlink = (string) get_post_meta((int) $id, self::META_SHORT_URL, true);
        return $surls_shortlink !== '' ? $surls_shortlink : $shortlink;
    }

    private function create_link_and_redirect(array $payload, string $redirect_url): void {
        $result = $this->create_link($payload);
        if (is_wp_error($result)) {
            $this->set_notice($result->get_error_message(), 'error');
        } else {
            $this->set_notice('Surls link created: ' . (string) $result['shortUrl']);
        }

        wp_safe_redirect($redirect_url);
        exit;
    }

    private function create_link(array $payload) {
        $options = $this->options();
        if (!$this->is_valid_api_base_url((string) $options['base_url']) || $options['api_token'] === '') {
            return new WP_Error('surls_not_configured', 'Add an HTTPS Surls base URL and API token first.');
        }

        if (empty($payload['destinationUrl']) || !$this->is_valid_absolute_url((string) $payload['destinationUrl'])) {
            return new WP_Error('surls_invalid_destination', 'Enter a valid destination URL.');
        }

        $response = wp_remote_post(
            $options['base_url'] . '/api/links',
            array(
                'timeout' => 15,
                'redirection' => 0,
                'sslverify' => true,
                'headers' => array(
                    'Accept' => 'application/json',
                    'Authorization' => 'Bearer ' . $options['api_token'],
                    'Content-Type' => 'application/json',
                ),
                'body' => wp_json_encode($payload),
                'data_format' => 'body',
            )
        );

        if (is_wp_error($response)) {
            return $response;
        }

        $status = (int) wp_remote_retrieve_response_code($response);
        $body = json_decode((string) wp_remote_retrieve_body($response), true);

        if ($status < 200 || $status >= 300) {
            $message = is_array($body) && !empty($body['error']) ? (string) $body['error'] : 'Surls API returned HTTP ' . $status . '.';
            return new WP_Error('surls_api_error', $message);
        }

        if (!is_array($body) || empty($body['shortUrl'])) {
            return new WP_Error('surls_invalid_response', 'Surls did not return a short URL.');
        }

        return $body;
    }

    private function options(): array {
        $options = get_option(self::OPTION_NAME, array());
        $options = is_array($options) ? $options : array();

        return array_merge(
            array(
                'base_url' => '',
                'api_token' => '',
                'default_code_from_slug' => '1',
                'include_wordpress_tags' => '1',
            ),
            $options
        );
    }

    private function is_configured(): bool {
        $options = $this->options();
        return $this->is_valid_api_base_url((string) $options['base_url']) && $options['api_token'] !== '';
    }

    private function supported_post_types(): array {
        return get_post_types(
            array(
                'public' => true,
                'show_ui' => true,
            ),
            'names'
        );
    }

    private function post_create_url(WP_Post $post): string {
        return wp_nonce_url(
            add_query_arg(
                array(
                    'action' => 'surls_create_post_link',
                    'post_id' => $post->ID,
                ),
                admin_url('admin-post.php')
            ),
            'surls_create_post_link_' . $post->ID
        );
    }

    private function parse_tags(string $tags): array {
        $values = array_map('trim', explode(',', $tags));
        $values = array_map('sanitize_text_field', $values);
        return array_values(array_filter($values));
    }

    private function is_valid_absolute_url(string $url): bool {
        $parts = wp_parse_url($url);
        return is_array($parts)
            && !empty($parts['scheme'])
            && in_array($parts['scheme'], array('http', 'https'), true)
            && !empty($parts['host']);
    }

    private function is_valid_api_base_url(string $url): bool {
        $parts = wp_parse_url($url);
        return is_array($parts)
            && strtolower((string) ($parts['scheme'] ?? '')) === 'https'
            && !empty($parts['host'])
            && !array_key_exists('query', $parts)
            && !array_key_exists('fragment', $parts);
    }

    private function set_notice(string $message, string $type = 'success'): void {
        set_transient(
            self::NOTICE_TRANSIENT_PREFIX . get_current_user_id(),
            array(
                'message' => $message,
                'type' => $type === 'error' ? 'error' : 'success',
            ),
            60
        );
    }

    public function render_admin_notice(): void {
        $key = self::NOTICE_TRANSIENT_PREFIX . get_current_user_id();
        $notice = get_transient($key);
        if (!is_array($notice) || empty($notice['message'])) {
            return;
        }

        delete_transient($key);
        $type = ($notice['type'] ?? '') === 'error' ? 'error' : 'success';
        printf(
            '<div class="notice notice-%1$s is-dismissible"><p>%2$s</p></div>',
            esc_attr($type),
            esc_html((string) $notice['message'])
        );
    }
}

register_activation_hook(__FILE__, array('Surls_Link_Creator', 'activate'));
new Surls_Link_Creator();
