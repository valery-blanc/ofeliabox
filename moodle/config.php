<?php  // Moodle configuration file

unset($CFG);
global $CFG;
$CFG = new stdClass();

$CFG->dbtype    = 'mariadb';
$CFG->dblibrary = 'native';
$CFG->dbhost    = 'mariadb';
$CFG->dbname    = 'moodle';
$CFG->dbuser    = 'moodle';
$CFG->dbpass    = 'wDB8tOhynW35CjB58gQq';
$CFG->prefix    = 'mdl_';
$CFG->dboptions = array (
  'dbpersist' => 0,
  'dbport' => 3306,
  'dbsocket' => '',
  'dbcollation' => 'utf8mb4_unicode_ci',
);

// Dynamic wwwroot: works via local IP (192.168.0.147), ZeroTier (10.115.169.147), or any hostname.
// Falls back to 192.168.0.147 for CLI operations (cron, langpack install, etc.)
$CFG->wwwroot = 'http://' . (PHP_SAPI === 'cli' ? '192.168.0.147' : (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '192.168.0.147')) . '/moodle';
$CFG->reverseproxy = true;

$CFG->dataroot  = '/var/www/moodledata/';
$CFG->admin     = 'admin';

$CFG->directorypermissions = 02777;

$CFG->dbport	= '3306';
$CFG->sslproxy	= false;
$CFG->preventexecpath	= true;
$CFG->enableanalytics	= false;
require_once(__DIR__ . '/lib/setup.php');

// There is no php closing tag in this file,
// it is intentional because it prevents trailing whitespace problems!
