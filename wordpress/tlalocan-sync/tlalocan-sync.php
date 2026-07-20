<?php
/**
 * Plugin Name: Tlalocan Sync
 * Description: Avisa a n8n (Reservalia) cuando un booking de MotoPress cambia de status, para sincronización en tiempo real con el sistema Tlalocan. El webhook de n8n hace un barrido idempotente, así que este ping solo lleva el ID y un secreto compartido (patrón "thin webhook"). Proyecto Sync Reservalia, F1 Fase B.
 * Version: 1.0.0
 * Author: Tlalocan / Reservalia
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TLALOCAN_SYNC_WEBHOOK', 'https://reservalia.app.n8n.cloud/webhook/tlalocan-mphb-booking');
define('TLALOCAN_SYNC_SECRET', '81166af869ca36e330a1097ca140fa26102d3e15009796ec');

add_action('mphb_booking_status_changed', 'tlalocan_sync_ping_booking', 10, 2);

function tlalocan_sync_ping_booking($booking, $old_status = null) {
    $booking_id = 0;
    $new_status = '';

    if (is_object($booking)) {
        if (method_exists($booking, 'getId')) {
            $booking_id = (int) $booking->getId();
        }
        if (method_exists($booking, 'getStatus')) {
            $new_status = (string) $booking->getStatus();
        }
    } elseif (is_numeric($booking)) {
        $booking_id = (int) $booking;
    }

    wp_remote_post(TLALOCAN_SYNC_WEBHOOK, array(
        'timeout'  => 3,
        'blocking' => false, // no frenar el checkout del huésped
        'headers'  => array('Content-Type' => 'application/json'),
        'body'     => wp_json_encode(array(
            'booking_id' => $booking_id,
            'new_status' => $new_status,
            'old_status' => is_string($old_status) ? $old_status : '',
            'secret'     => TLALOCAN_SYNC_SECRET,
        )),
    ));
}
