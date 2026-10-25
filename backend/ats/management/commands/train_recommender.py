from django.core.management.base import BaseCommand, CommandError

from ml.train_recommender import train_and_save


class Command(BaseCommand):
    help = "Train job matching from reviewed application outcomes."

    def handle(self, *args, **options):
        try:
            artifact = train_and_save()
        except ValueError as error:
            raise CommandError(str(error)) from error

        metrics = artifact["validation_metrics"]
        self.stdout.write(self.style.SUCCESS(
            f"Saved trained recommender using {artifact['training_samples']} reviewed "
            f"applications from {artifact['training_users']} users. "
            f"User-separated validation balanced accuracy: "
            f"{metrics['balanced_accuracy']:.3f}; ROC AUC: {metrics['roc_auc']:.3f}."
        ))
