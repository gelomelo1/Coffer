using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.Domain.Entities;
using DotNetEnv;
using Microsoft.IdentityModel.Tokens;

namespace Coffer.BusinessLogic.Services
{
    public class JwtService : IJwtService
    {

        private readonly string _secret = Env.GetString("JWT_SECRET") ?? throw new InvalidOperationException("JWT_SECRET envionmental variable is not set");
        private readonly string _issuer = "coffer.backend";

        public string GenerateToken(User user)
        {
            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("provider", user.Provider)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _issuer,
                audience: _issuer,
                claims: claims,
                expires: DateTime.UtcNow.AddYears(1),
                signingCredentials: creds
                );


            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
