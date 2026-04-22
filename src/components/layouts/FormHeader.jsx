import { PageHeader } from '../ui/AppPrimitives'

function FormHeader({
  title,
  eyebrow = 'Form',
  description = null,
  onBack,
  action = null,
  className = '',
  backLabel = 'Kembali',
}) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      action={action}
      backAction={onBack}
      backLabel={backLabel}
      compact
      className={className}
    />
  )
}

export default FormHeader
