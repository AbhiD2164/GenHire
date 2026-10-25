from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_education_institution_url"),
    ]

    operations = [
        migrations.RenameField(
            model_name="customuser",
            old_name="role",
            new_name="legacy_role",
        ),
        migrations.AlterField(
            model_name="customuser",
            name="legacy_role",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.RenameField(
            model_name="customuser",
            old_name="is_recruiter_verified",
            new_name="legacy_is_recruiter_verified",
        ),
        migrations.RenameField(
            model_name="customuser",
            old_name="recruiter_verification_notes",
            new_name="legacy_recruiter_verification_notes",
        ),
        migrations.RenameField(
            model_name="customuser",
            old_name="is_candidate_verified",
            new_name="legacy_is_candidate_verified",
        ),
        migrations.RenameField(
            model_name="customuser",
            old_name="candidate_verification_notes",
            new_name="legacy_candidate_verification_notes",
        ),
    ]
