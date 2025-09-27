using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Coffer.Domain.Entities.Interfaces
{
    public interface IGenericEntity<Tkey> where Tkey : notnull
    {
        Tkey Id { get; set; }
    }
}
