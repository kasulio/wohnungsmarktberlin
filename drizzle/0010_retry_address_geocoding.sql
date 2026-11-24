--> berlinovo used to store "Street 1\n\n12345 Berlin\n\nDeutschland"; the parser now writes "Street 1, 12345 Berlin".
UPDATE `flat`
SET `addressText` = replace(replace(`addressText`, char(10) || char(10) || 'Deutschland', ''), char(10) || char(10), ', ')
WHERE `propertyManagementId` = 'berlinovo' AND instr(`addressText`, char(10)) > 0;
--> statement-breakpoint
--> Geocoding now retries "5B" as "5"; give listed flats that failed before another go.
UPDATE `flat`
SET `addressImprovement` = 'pending'
WHERE `addressImprovement` = 'failed' AND `addressId` IS NULL AND `deleted` IS NULL;
