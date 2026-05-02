#!/usr/bin/perl
# Creates Koha branch, patron category S, and superlibrarian on first install.
# Must be run with KOHA_CONF and PERL5LIB set (done by entrypoint.sh).
# Usage: perl setup-admin.pl <admin_password>

use strict;
use warnings;
BEGIN { push @INC, '/usr/share/koha/lib' }

use C4::Context;
use Koha::Library;
use Koha::Libraries;
use Koha::Patron::Category;
use Koha::Patron::Categories;
use Koha::Patron;
use Koha::Patrons;

my $pass = $ARGV[0] or die "Usage: $0 <password>\n";

my $dbh = C4::Context->dbh;

# Idempotency check — skip if superlibrarian already exists
my ($count) = $dbh->selectrow_array(
    q{SELECT COUNT(*) FROM borrowers WHERE flags & 1 = 1}
);
if ($count > 0) {
    print "Superlibrarian already exists — skipping\n";
    exit 0;
}

# Create library branch if none exists (required FK for patron creation)
my ($branches) = $dbh->selectrow_array(q{SELECT COUNT(*) FROM branches});
unless ($branches) {
    Koha::Library->new({
        branchcode => 'MAIN',
        branchname => 'Biblioteca EduBox',
    })->store;
    print "Branch MAIN created\n";
}

# Create staff patron category S if none exists
unless (Koha::Patron::Categories->find('S')) {
    Koha::Patron::Category->new({
        categorycode     => 'S',
        description      => 'Staff',
        category_type    => 'S',
        enrolmentperiod  => 99,
        enrolmentfee     => 0,
        reservefee       => 0,
        hidelostitems    => 0,
    })->store;
    print "Patron category S created\n";
}

# Create superlibrarian (flags=1 grants full access in Koha)
# store() first — set_password() requires the patron to exist in DB
my $patron = Koha::Patron->new({
    cardnumber   => 'KOHAADMIN',
    surname      => 'Admin',
    categorycode => 'S',
    branchcode   => 'MAIN',
    userid       => 'koha_admin',
    flags        => 1,
    dateexpiry   => '9999-12-31',
})->store;
$patron->set_password({ password => $pass, skip_validation => 1 });
print "Superlibrarian created: userid=koha_admin\n";
